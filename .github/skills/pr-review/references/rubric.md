# Review Rubric

## Severity

Severity describes the consequence of shipping the change as written. It does not
describe how sure you are, and it does not describe the size of the diff.

| Severity | Test | Examples |
|---|---|---|
| **High** | Correctness or a stated guarantee is broken on a path a consumer will reach. A false guarantee, or a guaranteed failure. | An external write bypasses encapsulation; a trap reports success for a rejected mutation; an `async` entry violation throws synchronously; a declared type disagrees with what the decorator registers. |
| **Medium** | The behaviour is wrong but recoverable, or the failure needs an unusual-but-reachable condition. | A tab visible when it should not be; a stale cache after an update; a missing audit row; a state that only breaks on re-entry. |
| **Low** | The cost is confusion or maintenance. It will not misbehave today. | A duplicated constant; a comment that contradicts the code; a dead branch; a misleading test name. |

Anything you cannot verify is **not** a severity. It is a question, listed after
the findings.

### Escalation and de-escalation

- Raise to **High** when the failure is silent. A thrown error is noticed. A
  dropped write is not.
- Raise to **High** when the defect is on every path, not an edge. A SQL binding
  mismatch on the main query fails the feature outright.
- Drop to **Medium** when the author has clearly documented the trade-off in the
  code or the PR body.
- Drop to **Low** rather than omit, when the finding is a genuine invariant break
  with no current reachable trigger.

**DOCUMENTATION LOWERS SEVERITY. IT NEVER LOWERS THE FINDING.** A comment, a
plan note, or a PR-body caveat explains a trade-off; it does not remove the
disadvantage the trade-off carries. This rule exists because it is the easiest way
for a real defect to leave a review: the author noticed it, wrote a paragraph about
it, and the reviewer — reading the paragraph as diligence — files nothing. Ask
*"if this comment were deleted, would this be a finding?"* If yes, it is a finding
now, at whatever severity the documentation justifies. A documented defect is still
a defect; a documented **unfixed** defect is still a finding.

Related: a plan or docblock that asserts a behaviour is working is not evidence that
it works. See Ground Rule 8.

## Failure classes worth hunting here

The library's recurring defects cluster into these shapes. Check each one
deliberately; they are what a generic reviewer misses.

### Encapsulation and the traps

- **A door onto a mutation that no trap covers.** `set`, `defineProperty`,
  `deleteProperty`, and `setPrototypeOf` all mutate the instance's surface. A guard
  added to one and not the others is the defect this file has produced repeatedly.
  Enumerate the doors, then check each.
- **A trap that ignores the operation's result.** `Reflect.set` can return `false`;
  so can `defineProperty` and `deleteProperty`. A trap that returns `true` anyway
  reports success for a mutation that did not happen, and strict mode never raises.
- **A prototype setter used to authorise definition.** Assignment invokes the
  accessor; defining an own property shadows it. The `set` rule does not transfer.
- **A descriptor with no `value` and no accessor.** That is what `freeze` and `seal`
  do per property; refusing it makes an instance impossible to freeze. Check the
  carve-out is present and that it is not wider than that.
- **The read-only view weaker than the instance.** A predicate must not be able to
  do what a caller cannot. Compare `src/read-only.mts` against the proxy handler.

### Trap interaction and re-entrancy

- **A trap delegating through a form that re-enters a sibling.** `Reflect.set(target,
  prop, value, receiver)` with the proxy as receiver routes through
  `defineProperty`. A guard then runs twice, once unexpectedly. Read the delegation
  chain of every changed `Reflect.*` call.
- **A body that runs against the proxy rather than the target.** Per-feature wrappers
  apply the body to `target` so internal calls do not start a second lifecycle. A
  change that inverts this needs a re-entrancy guard, or the invariant is evaluated
  N times per call.
- **A proxy invariant broken by a wrapper.** Returning a wrapper for an own,
  non-configurable, non-writable data property throws at the `get` trap. A change
  that lets a caller create such a property can brick the instance rather than
  bypass a check. Probe it.

### Composition and variance

- **An arm that cannot be reached.** `@demands` is OR-composed, so a throwing arm
  that aborts evaluation makes every later (weakening) arm dead. A subtype is
  permitted to weaken a precondition; a composition rule that makes it unreachable
  is a correctness defect, not a nuance.
- **A composition rule written in two places.** OR for `@demands`, AND for
  `@ensures` and `@invariant`. A fourth hand-built loop will disagree about
  short-circuiting, or about which arm's normalized value wins.
- **Normalization precedence.** The first passing `@demands` arm decides the value,
  and arms evaluate in reverse source order because decorators evaluate bottom-up.
  "First declared" and "first evaluated" are different claims; check which the code
  and the docs say.
- **A change that makes composition order-dependent without saying so.**

### The lifecycle and its boundary

- **An entry check that throws where the body would reject.** An `async` feature's
  entry violation must reject, not throw, or adding a contract changes how a caller
  observes a failure. Same for a generator: a violated `@demands` on the call must
  surface at the call.
- **A generator exit check at the wrong place.** `@ensures` runs when `next()`
  returns, not on the following resume. Deferring it leaves the instance knowingly
  invalid for the whole traversal, and a suspended instance is publicly reachable.
- **State that survives a `retry`.** The `old` snapshot, `retries`, the generator's
  `needsEntry`, and `retriedError` are per-attempt. A `for (;;)` loop that carries
  one across a `continue` re-enters the lifecycle with the failed attempt's
  leftovers.
- **A thenable that is not classified.** `assertNotThenable` exists because a sync
  body returning a promise is checked before it has run. An `await` on an
  unclassified value moves the boundary.
- **Checked mode consulted at the wrong time.** `Contracted[checkedMode]` is read
  in five modules. A path that captures it at module load, caches it per instance,
  or writes it outside a test is a finding.

### Types and the published surface

- **A declared type that does not match the registration.** The
  `Contracted[Symbol.metadata]` declaration is public. If the decorator stores
  `{ arm, options }`, the declaration must say so; otherwise the consumer's code
  compiles and throws.
- **A schema arm whose `Input` is pinned.** `StandardSchemaV1` is invariant in
  `Input`, so pinning it to `any[]` rejects real providers.
- **An export added or removed without a version story.** `src/index.mts` is the
  public surface, and `dist/*.d.mts` is what a consumer's compiler reads.
- **A diagnostic that depends on a name the bundler can change.** `constructor.name`
  is minified; `AssertionError.name` is set explicitly for this reason.

### Identity

- **Comparing the read-only view with the raw target.** They are different objects,
  and `readOnlyView` is memoised per target precisely so that repeated evaluation
  sees the same `self`.
- **Comparing `old` with `self` by identity.** `old` is a detached copy; only class
  instances inside it are shared by reference, which is deliberate and documented.
- **A key that assumes the proxy and the target hash alike.** `wrapperCache` and
  `readOnlyViews` are `WeakMap`s keyed by the target for a reason.

### Comments

The instructions file devotes itself to one rule, and it is the finding this
repository produces most often. A comment that narrates how the code got here —
"previously", "used to", "was unguarded", "no longer", "this fixes", "regression" —
is a violation even when it is accurate and even when it is useful. The test:
**would this sentence still be useful to someone who has never seen the previous
version?** If not, delete it and state what is true.

A comment that *contradicts* the code is worse than either: it reads as
authoritative, so the next reader trusts it instead of checking.

### Build and packaging

- **A change that only works with a stale `dist/`.** `dist/` is git-ignored and
  generated; `npm run build` from a clean tree is the check.
- **A test that passes because of the `prebuild` lint hook.** `npm run build` lints
  first, so a mutation experiment must call `npx webpack` directly.
- **Line-ending churn.** `src/**/*.mts` are LF; `README.md`, `package.json`,
  `tsconfig*.json`, and `.github/**` are CRLF. A one-line change with a
  hundreds-of-lines diff is this defect.

### Evidence that cannot support its claim

The failure class for any change that cites a measurement. It is separate from the
code's correctness because a run can be executed perfectly and still answer a
different question.

- **The treatment was never applied.** The run claims a condition held; nothing in
  the driver created it. Find the line. A harness whose step is described in a
  comment but absent from the code measures the commented-out world.
- **The mechanism's holder is the thing that left.** A claim that X survives the
  loss of Y, measured on a run where Y was X's only support. The result, if
  positive, is a different phenomenon than the one claimed.
- **A proxy clock.** Delivery time, acceptance time, flush time, or log time
  standing in for the moment the thing happened. Every one of them lags, and the
  lag is exactly the direction that turns "before" into "after".
- **A named moment that was inferred rather than captured.** A field called
  `departure` holding a last utterance, or `startedAt` holding a first request.
  Read what populated it, not what it is called.
- **A verdict weaker than the claim.** The driver exits success on "anything
  arrived", and the plan cites it as "the behaviour survived". The gap between what
  the driver checks and what the prose asserts is the defect.
- **An instrument's own failure reported as a finding.** The read broke; the driver
  printed zero. Look for the branch that cannot distinguish them, then check
  whether the run that produced the cited numbers took it.

## What to cite

- The decision ID and the requirement it comes from, when the finding is a spec
  deviation. Without the ID the author cannot tell a defect from a preference.
- The exact line for every finding.
- Every additional site for a duplicated defect.

## Questions, not findings

Use these forms when the concern is real but unverified:

- "Is `old` guaranteed to be defined here? `populateOld` returns `undefined` when
  checked mode is off, and `assertEnsures` takes `old: Contracted`."
- "Does this hold when the instance is frozen? `Reflect.set` reports failure and the
  trap now propagates it."
- "Does this depend on `constructor.name`? It is minified in a consumer's build."

A question does not get a severity, a verdict, or a place in the findings count.

## Conformance and design findings

These are findings, but they rank lower than defects on the same line of the
verdict. A broken query outranks a misplaced helper, every time.

### House-rule conformance (Pass E)

| Broken rule | Severity | Why |
|---|---|---|
| **A comment narrating history** ("previously", "used to", "no longer", "this fixes") | **Low**, **Medium** when it contradicts the code | The instruction is absolute. A stale comment reads as authoritative, so the next reader trusts it instead of checking. |
| A comment that contradicts the body it documents | **Medium** | It is worse than no comment: it is confidently wrong about the code beneath it. |
| A commit, push, or PR opened without approval | **High** | It is a process violation, and it hides the diff from review. |
| A package version bump in an unrelated change set | **Medium** | The maintainer owns version bumps; an incidental bump conflicts with the release plan. |
| A non-barrel re-export, or logic inside `index.mts` | **Low** | It blurs the public surface and changes import semantics for consumers. |

A conformance finding must quote the instruction. If you cannot quote it, the
finding is an opinion and does not belong in the review.

### Test adequacy (Pass C′)

The severity is the severity of the criterion the test fails to prove — a vacuous
test converts a defect into an unverified claim, and an unverified claim ships.

| Condition | Severity | Why |
|---|---|---|
| An acceptance criterion has **no** test | **High** | The spec says someone promised this behaviour; nothing checks it. |
| A test exists but its fixture never reaches the branch the criterion names | **High** | It reads as coverage on a dashboard while proving nothing. |
| The assertion reads **part** of a composite observable the criterion names | **High** | It checks the command's name but not its arguments, the row's presence but not its state, the count but not the attribution. The defect changes exactly the part left unread, and the suite stays green forever. |
| The assertion reads an observable the defect does not change | **Medium** | It will stay green through the regression, but only for the paths it covers. |
| **Every fixture invokes a multi-attempt path once** | **High**, when the criterion is about the second attempt | "Parsed what this attempt fetched" and "parsed what is already stored" compute the same value when both attempts get identical inputs. The criterion is unproved for the case it names. |
| **The fixture SUPPLIES the condition the code branches on** | **High**, when the criterion *is* the fallback | The criterion is a `?? 0`, a defaulted field, or a second union arm; the fixture provides the key anyway, so the fallback and the direct read agree. A test of a fallback must OMIT what it falls back from — check the stub's shape, not only its value. |
| Only the happy path is exercised where the spec names a refusal, a null, or a second run | **Medium** | The failure the criterion exists to prevent is untested. |
| A criterion is **partly** pinned: one mutation is caught, a sibling input survives | **Medium** | The partial pin is what ships a defect behind a green suite, because the caught mutation is the one that gets cited. |
| The test asserts the stub's return value rather than the code's decision | **Low** | It is documentation of the mock, not of the behaviour. |
| A fake or spy records **less than the real call** (drops a rest parameter, keeps only a name) | **Medium** | Every assertion above it is blind to what the fake discarded, and none of them can fail. Fix the fake first; the tests that follow are the reason it matters. |

Report the criterion by ID, the assertion's location, and the mutation that
survives. "The dedupe is untested" is not a finding; "the dedupe test survives
removing the cancellation at `:697`, so D2's criterion is unproved" is.

**A caught mutation is not a verdict.** It proves the assertion is not vacuous
along one dimension. Report the dimensions you mutated, and treat an unmutated
input as unproven rather than as passing.

### Measurement validity (Pass H)

Applies whenever the change set cites a measurement, or touches an instrument. The
severity is the severity of the claim the measurement is load-bearing for: a run
quoted as the sole proof of a milestone criterion is High, because the criterion is
then **unproven**, not merely weakly supported.

| Condition | Severity | Why |
|---|---|---|
| The driver never instantiates the treatment the claim describes | **High** | The run measured something else. Every number from it is about a different configuration. |
| A behaviour the claim relies on is supplied by a component the harness does not mount | **High** | The mechanism is absent from the run, so a positive result demonstrates its absence rather than its sufficiency. |
| The mechanism's only holder in the run is the thing whose loss the claim survives | **High** | The run measured the negative control as though it were the experiment. |
| The clock cannot separate the claim from its alternative | **High** | Delivery time is not speech time; acceptance is not occurrence. If a failed mechanism would produce the same timestamps, the run distinguishes nothing. |
| A failed read is indistinguishable from a negative result | **Medium**, **High** if the run decides a criterion | An instrument that answers `0` for both "nothing there" and "I could not look" will confidently report the wrong verdict. |
| The verdict is a count rather than the property claimed | **Medium** | "N events arrived" cannot tell a complete run from a truncated one, nor a correct attribution from a shuffled one. |
| The fixture's field names, or its own `_limits` note, contradict what the tests assert from it | **Medium** | The next reader trusts the name. A fixture documenting its own inability while a test asserts the conclusion is a finding against the test. |

Report the claim, the run, and the observation that would have differed. "The
measurement is weak" is not a finding; "the guest never issued `setSubtitles`, so
the run held one request — the configuration the guarantee says cannot occur — and
9 post-departure chunks therefore demonstrate persistence, not the N-deep model" is.

### Clean Architecture and DRY (Pass F)

| Violation | Severity | Why |
|---|---|---|
| A contract module imports another contract module | **High** | The composition rules stop being independently readable, and the `descriptorType` duplication returns. |
| A contract's signature takes a feature kind or descriptor type | **High** | The contract describes `P` or `Q`; the lifecycle owns the boundary. |
| `assert.mts` or `AssertionError.mts` imports `Contracted` | **High** | A cycle makes the error type depend on the class it reports on. |
| A decorator bypasses `assertFeatureContractTarget` | **High** | The target rule now has two implementations that will drift. |
| Logic inside `index.mts` | **Medium** | The barrel changes import order semantics for every consumer. |
| `server/application` imports an HTTP concern | **Medium** | The use case can no longer run without a request. |
| A duplicated composition rule or boundary decision | **Medium** | The copies drift, and the drift is a defect. Name both sites and the abstraction that should own it (`evaluateArm`, `ensuresArgs`, `violationError`). |
| A DTO schema restating fields that already exist in another schema | **Medium** | Zod composes. The copy will miss the next field added to the original and validate a stale contract. Name the derivation `.extend`, `.pick`, or the field-map factory to use. |
| A DTO pair duplicated where only a refinement differs | **Low** | Use `stripRefinements` / `createDraftSchema` rather than writing the shape twice. |
| A helper that restates `shared/utils` | **Low** | Report only when the existing helper is genuinely equivalent and exported. |

What is genuinely two contracts is a difference in **semantics** (lifecycle,
audience, or a documented divergence), not in appearance. Even then the shared
part composes; only the distinct part is written twice.

A contract module importing `admissibility` or `assert` is the intended design, not a
violation. Only an import between two contract modules, or a leaf importing
`Contracted`, crosses the line.

The DRY threshold is the third copy. Two similar blocks may be coincidence; three
is a missing abstraction. State which of the three you are reporting.

### What these passes must not produce

- A list of house rules that the change happens to satisfy.
- A "consider extracting this" with no named second site and no named drift.
- A layer complaint that the barrel file already answers.
- A restatement of a lint rule.
- A duplicated-field-block finding that stops at "these look alike" instead of
  naming the derivation and the drift.

## Design findings (Pass G)

The designer lens judges consequences that only appear once a consumer adopts the
library. Most of what it notices is **not** a merge blocker: it belongs in the API
Impact section. A finding is reserved for the cases below.

| Concern | Becomes a finding when | Severity |
|---|---|---|
| **Export surface** | A public export is added without a reason to be public, or removed or narrowed without a version story | **Medium**, **High** if it is breaking |
| **Consumer requirement** | The change only works if a consumer restructures their class — declares a constructor, avoids `#private`, avoids a getter, changes their bundler | **High**, because the library proxies classes it does not own |
| **Composition or variance** | A change makes the composed behaviour depend on declaration order, arm count, or evaluation short-circuiting, and does not document it | **High** — it makes a legal subtype's arm unreachable |
| **Diagnostics** | A failure produces no `violation`, or a field whose value depends on the bundler | **Medium**, **High** if an error boundary misroutes because of it |
| **Boundary placement** | The exit check moves, or a feature kind is handled by the wrong lifecycle | **High** |
| **Cost** | An allocation, a `Proxy`, or a `WeakMap` lookup is added per *call* rather than per instance | **Medium** |
| **Trust boundary** | A trap gap lets an external caller mutate state the contracts claim to protect | **High** |
| **Operability** | A new diagnostic depends on a name the bundler can change, removing the consumer's only signal | **Medium** |
| **Recorded decisions** | A design choice is made in code without its reason in the comment, where the next contributor will "fix" it | **Low** to **Medium** |
| **Reversibility** | A permanent artifact (an export, a declared type, a `ContractViolation` field) is decided casually | **Medium** |

### Things that are not design findings

- A shape you would have chosen differently, where the current one is defensible.
- Missing abstraction with exactly one implementation.
- A trade-off that is already written down in a comment at the decision site.
- "This will not scale" with no named limit and no measured or estimated volume.
- A microservice, a message bus, or a cache proposed without a cost and a failure
  mode.

When the concern is real but the change is defensible, it goes in API Impact as a
trade-off, not in the findings as a defect.

