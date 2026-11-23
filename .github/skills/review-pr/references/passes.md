# Passes B through H

The body of each review pass, in the order to run them. The ground rules, the
change-set procedure, and passes A and A′ are in `../SKILL.md`; read them first.

Open one pass at a time, as you reach it.

## 6. Pass B — re-entrancy, trap interaction, and lifecycle

Ask of every changed function: *what happens on the second call, in which the
proxy is re-entered, and what happens when the body rejects or yields?*

**THE FIRST QUESTION IS ABOUT THIS CHANGE, NOT ABOUT THE PATTERNS BELOW.** The
bullets are recurrences. The question that finds the defects they miss is:

> **What does this change newly make TRUE, and what ENFORCES it?**

This library builds invariants out of proxies, and a new trap or wrapper creates a
constraint that did not exist before — so nothing was broken beforehand and no
familiar pattern fires. Name the constraint, then **name the handler for its
violation**.

- **A body runs against the raw target, and that is load-bearing.** The `get` trap
  returns per-feature wrappers that apply the body to `target`, so internal calls do
  not re-enter the traps. A change that makes a body run against the *proxy*
  instead must add a re-entrancy guard, or every internal `this.x` starts a second
  lifecycle and the invariant is evaluated N times per call.
- **Trap interaction.** A trap that delegates to `Reflect` can re-enter a sibling
  trap. `Reflect.set(target, prop, value, receiver)` with the proxy as receiver
  routes through `defineProperty`, so a guard in `set` is decided twice — once
  where it was written and once, unexpectedly, in the trap that was supposed to be
  independent. Read the delegation chain of any changed `Reflect.*` call, and
  prefer the form that does not pass the receiver when the target write is what was
  authorised.
- **A trap's return value is a verdict.** Returning `true` from `set` when the
  target refused the write reports success for a mutation that did not happen, and
  strict mode never raises. Same for `defineProperty` and `deleteProperty`. A trap
  that ignores the `Reflect` result is the defect; the `false` path must survive to
  the caller.
- **Proxy invariants cannot be broken silently.** Returning a wrapper for an own,
  non-configurable, non-writable data property throws at the `get` trap. A change
  that allows a caller to make such a property — `defineProperty`, `freeze`,
  `preventExtensions` — can brick the instance rather than merely bypass a check.
  Probe it; do not reason about it.
- **Checked mode is process-global and read in eight places.** `Contracted[checkedMode]`
  is consulted in `Contracted.mts`, `demands.mts`, `ensures.mts`, `invariant.mts`,
  and `rescue.mts`. A new early-return is fine; a new code path that *writes* it,
  caches it, or captures it at module load is a finding.
- **The lifecycle must be restartable.** `@rescue` can `retry`, and a retry re-enters
  `@invariant` -> `@demands` -> body -> `@ensures`. Any state a lifecycle keeps
  (the `old` snapshot, `retries`, the generator's `needsEntry`, `retriedError`)
  must be scoped so a retry does not inherit the failed attempt's leftovers. Read
  the `for (;;)` loop and ask what survives a `continue`.
- **A generator's boundary is per step.** `@ensures` runs when `next()` returns, not
  on the following resume. A change that moves the exit check, or that checks only
  at completion, leaves the instance knowingly invalid for the whole traversal — and
  a suspended generator's instance is publicly reachable. Check the four transitions
  (`next`, `return`, `throw`, and abandonment).
- **Thenables.** A non-`async` body that returns a thenable must fail closed via
  `assertNotThenable`; an `async` body's entry violation must reject rather than
  throw. A change that awaits a value it did not classify moves the boundary and
  changes when the caller observes a failure.
- **Identity across the proxy.** The instance handed to a predicate is the read-only
  view, and `old` is a detached copy. A change that compares them by identity, or
  that caches against one and looks up the other, is broken. `readOnlyView` is
  memoised per target for exactly this reason.
- **Module-level state.** `wrapperCache` and `readOnlyViews` are `WeakMap`s keyed by
  the target. A change that adds a `Map`, a counter, or a module-level array is a
  leak, and in a library that a consumer may load more than once, it is also a
  correctness risk. Use a `WeakMap` or put the state on the instance's metadata.

## 7. Pass C — spec conformance

Walk the checklist from step 2 against the implementation. Cite the decision ID.

**A criterion is met only when every path that can produce its outcome is
correct.** Naming the one path the spec itself describes is not enough: a
criterion like *"an OR-composed precondition permits a later arm"* is broken by
ANY path that can suppress or short-circuit evaluation, including an early
`return`, a throw from an earlier arm, a schema that normalizes, or a second
composition site in a different lifecycle. For each criterion, enumerate the paths
that can violate it, then check each one.

**Review against the ISSUE, not against the plan** — Ground Rule 8. Read the
issue body, then verify the code; do not audit the implementation against the
author's own rationalisation of it. Where the plan and the issue disagree, the
issue wins.

Two valid outcomes when the code contradicts the spec:

- the code is wrong, so the finding stands; or
- the design decided otherwise, so the **spec is stale** and the PR must update it.

Both are findings. Do not accept silence as agreement.

## 8. Pass C′ — test adequacy

**A test that cannot fail is not evidence.** Every acceptance criterion needs an
assertion that would fail if the implementation were wrong, and that is a
separate question from whether a test file mentions the criterion.

Work in this order. The order is the point: steps 0 and 1 decide *what* to assert,
and they are the ones that get skipped when a test file looks convincing.

**0. State the observable.** Before opening any test, write down what the
criterion would look like when it is wrong — the *specific value* that must differ.
Not "the decorator ran" but "the instance the predicate **received**". Not "the
call succeeded" but "the `violation.failedIndices` it produced". Not "the arm was
evaluated" but "the **second** arm was evaluated after the first failed".

An observable is a thing that can be read from the implementation's output: a
function's arguments, a returned collection's membership, a written row's column, a
delivered payload's field. If you cannot name one in a sentence, the criterion is
not testable as written, and that is the finding.

**AND AN OMISSION HAS NO MUTATION.** Every mutation you can run *removes or
changes code that exists* — so a mutation result can never surface a guard that
was never written, a control that was never gated, or a branch that was never
added. A green suite plus six caught mutations is therefore consistent with an
implementation that is **entirely missing** a required guard.

So before you open any test, list the guards you *expected* the implementation to
contain and confirm each one is present. Write them as assertions you would have
written: "this control is disabled for a caller its verb would refuse", "this
read is scoped to the session", "this branch refuses". Then look for each in the
code. A guard you cannot find is a finding, and no test file can tell you it is
missing — `grep` the code, not the suite.

This is the Pass C′ twin of the rule that a missing test is a finding: **a missing
guard is a finding, and mutation testing is structurally blind to it.**

**1. Find the assertion, and check it reads THAT observable.** A criterion mapped
to a file name is unmapped. Then check the assertion actually reads the observable
from step 0 — not a proxy for it. This is where most false confidence comes from:

| The criterion needs | An assertion on this is NOT enough |
| --- | --- |
| the **arguments** of a call | the command's name. `setSubtitles`, `setSubtitles(false)`, and `setSubtitles(true)` all share a name; two of them are the defect. |
| the **order** of a sequence | its length, or its membership. |
| the **value** of a field | the field's presence. `toEqual({ flag: true })`, not `toBeDefined()`. |
| the **raw target** reaching a body | the read-only view reaching it. Both pass when the guard is deleted. |
| one **specific** row | a count that includes it. |
| a **rejection** | the happy path's shape. |

**2. Read the fixture.** Does it actually reach the code path? A fixture whose
input field is empty, whose two sides are identical, or which passes props
straight to a leaf proves nothing about the wiring above it.

**3. Name the mutations — plural — check each, and record which dimensions you
checked.** State what change to the implementation must make this assertion fail,
then check the assertion observes that difference. If the only observable
difference is a value the test does not read — an internal count, a prompt the
stub never varies, a branch both behaviours take — the test is vacuous and the
criterion is **unmet**.

**ONE KILLED MUTATION IS NOT A PROVEN CRITERION.** Mutate **each independently
variable input**, not the assertion as a whole. A criterion about a call has two
inputs — which command, and with what arguments — so it needs two mutations, and
killing one while the other survives means the criterion is **partly unproved**.
The same holds for a collection (mutate the membership and the order), a filter
(mutate the predicate and the value it compares), and a flag (mutate it on, then
off). A suite that goes red feels like verification; it is one dimension checked.

Report the verdict per mutation. A SURVIVED mutation is a finding even when its
siblings were caught — a partially-pinned criterion is exactly the shape that
ships a defect behind a green suite.

Common shapes of a vacuous test, each worth checking deliberately:

| Shape | Why it passes anyway |
| --- | --- |
| The fixture is degenerate | Every field the code branches on is empty, defaulted, or identical on both sides. |
| The assertion reads the wrong observable | It counts writes where the defect changes provenance, or reads a summary where the defect changes an ordering. |
| **The assertion reads part of a composite observable** | It checks the command name but not its arguments, the row's presence but not its state, the count but not the attribution. The defect changes exactly the part left unread. |
| **Every run is the FIRST run** | The code has more than one attempt — a retry, a resumed write, a second pass — and every fixture invokes it once. Then "parsed what this attempt fetched" and "parsed what is already stored" compute the SAME value, because both attempts supplied identical inputs. Nothing is too small: the scenario is never *repeated with a different input*. |
| **The fixture SUPPLIES the condition the code branches on** | The criterion is a fallback — `map.get(id) ?? 0`, an optional field defaulted, a union's second arm only reached when the first is absent. The fixture provides the key/field anyway, so the fallback and the direct read compute the same value. **A test of a fallback must OMIT the thing it falls back from** — override the stub to answer a map without the key, an object without the field, a response without the arm. Check the stub's SHAPE, not just its value: a fixture listing `a2: 0` is present, and `?? 0` is then unreachable. |
| The test asserts the mock | It re-states the stub's return value instead of the code's decision. |
| Only the happy path | The refusal, the null, the empty result, or the second run is never exercised. |

**MUTATE THE FIXTURE, NOT ONLY THE SOURCE.** A change that adds a second attempt
(retry, resume, replay, reconciliation) needs a fixture where attempt two's input
DIFFERS from attempt one's — bytes that are shorter, an id that changed, a clock
that moved. Then ask which of the two values the assertion reads. A suite that only
ever mutates the source cannot see this: `mutate.mjs` edits implementation and
re-runs, so it is blind by construction to a defect that lives in the *inputs*.
When the second attempt is the interesting one, state the fixture difference as the
observable, not just the code path.

**A stub that records less than the real call hands you this bug.** Before
trusting any assertion on a fake or spy, read what the fake **stores**. A fake
whose `executeCommand(name)` signature drops the rest parameter records names and
silently discards the arguments — so every test above it is blind to them, and none
of them will ever fail. Fix the fake first, then the assertions. This is a Pass A
finding about the test harness, not a later one about the test.

**RUN THE MUTATION CHECK ON EVERY ASSERTION YOU BLESS — not only the uncertain
ones.** "When you cannot decide" is the wrong trigger, because the failures are
confident: the reviewer who is unsure runs the check, and the reviewer who is sure
reasons instead and is wrong. The two cases that most reliably escape are *a test the
review itself wrote or amended during the review* (its author already believes it) and
*a criterion the implementation's own docblock claims* (the comment reads as proof).

**Every criterion you would mark ✅ gets at least one mutation, and the mutation
targets the input the criterion is about.** If you cannot name a code edit whose
absence would turn that assertion red, the criterion is ⏳ regardless of how
obvious the code looks. Run it with `mutate.mjs`; its invocation, exit
codes, and flags are in `mutation-harness.md`.

"I believe this holds" is not a verdict. "Removing the cancellation makes this
assertion fail" is. "Removing the cancellation fails this assertion, but passing
`false` instead of `true` does not" is the honest one.

**A missing test is a finding, not a question.** Name the branch, name the
mutation, and file it.

## 9. Pass D — propagation

A changed contract has more call sites than the diff shows.

- Grep each changed field, prop, method, and DTO member across the workspace.
- For a prop, walk the whole pass-through chain to the consumer. A prop that is
  threaded through four components and dropped at the fifth renders empty, and no
  unit test that passes props directly to the leaf will catch it.
- **Grep the verbs, not just the names.** The propagation that matters most is the
  one a diff hides by *renaming nothing*. A decorator that delegates —
  `@demands → assertDemands → evaluateArm → assertNormalizable`, a trap that
  delegates to `Reflect.set` which re-enters `defineProperty`, a lifecycle helper
  that calls `runGeneratorLifecycle` which calls `attemptRescue` — fails at the
  **callee**, and the callee is often a site the diff never touches. For every
  re-guarded or newly-added check, follow the delegation chain to the last hop and
  check *that* one. Report the whole chain in the finding, so the author can see
  which link was wrong.
- Report the missed sites as one finding that lists all of them.

## 10. Pass E — house-rule conformance

`.github/copilot-instructions.md` is currently short: a rule about comment style,
and a rule about the git workflow. Read it anyway, bullet by bullet — it is the
source of truth, and this table is only a convenience.

| Instruction | Verify | Lint sees it? |
| --- | --- | --- |
| **No history lessons in comments** | A comment that narrates how the code got here — "previously", "used to", "was unguarded", "no longer", "this fixes", "regression", or a reference to the bug that prompted it — is a violation. The test: **would this sentence still be useful to someone who has never seen the previous version?** If not, delete it. State what is TRUE, not what changed | No |
| State a constraint as a fact | Prefer "a prototype setter does not widen this, because …" over "unlike `set` this was wrong before" | No |
| Comment the *reason*, not the mechanics | A comment restating the line beneath it is noise; the non-obvious reason is the content | No |
| **Do not commit, push, or open a pull request** | Check the *process*, not the file: is there a commit, a push, or a branch publish that the change set did not have approval for? A review that finds the code perfect while the branch was auto-published is a failed review. Also confirm the review is not staged `git add`ed output presented as a proposal | No |
| Do not bump the package version | The maintainer owns version bumps. A `package.json` version change in an unrelated change set is a finding. If the change *is* the release, say so and check `package-lock.json` agrees | No |

**The comment rule is the one that actually bites here**, because comments are
the part of a diff a reviewer skims. Read every added or changed comment
deliberately, not as scaffolding around the code.

**THE TABLE IS A CONVENIENCE, NOT THE SOURCE OF TRUTH — RE-READ THE FILE.** So
open the instructions file and walk it bullet by bullet against the change set. If
a bullet has no row here, that is a gap in this skill — check it anyway, and say so
in the review.

Two invariants that are *not* in the instructions file but are just as binding,
because they are what the library promises:

- **The encapsulation rule is name-based.** Only `_`-prefixed properties may be
  assigned, defined, or deleted from outside; a prototype setter authorises
  assignment but not definition; `freeze`, `seal`, and `preventExtensions` are
  permitted. A change that widens any of these is a false guarantee, not a
  convenience.
- **Predicates cannot mutate the instance.** They receive the read-only view. A
  change that hands a predicate the raw target, or that adds a contract whose
  predicate must write to answer its question, defeats `#324`.

Report only the rule that the change actually breaks. A change that touches none
of these produces no findings from this pass, and that is the expected result.

## 11. Pass F — module boundaries and duplication

Two questions, asked of every changed file.

**Does the dependency point one way?** The module graph is small and flat, and
each layer has one job:

```text
index.mts        public surface: re-exports only
  |
Contracted.mts   the proxy, the traps, the four lifecycles
  |
demands / ensures / invariant / rescue   per-contract composition
  |
admissibility    arm evaluation (predicate vs schema), shared by all contracts
  |
assert / AssertionError / decorator / types   leaf utilities
```

The rules that follow:

- **`Contracted.mts` may import the contracts; the contracts must not import each
  other.** `demands.mts`, `ensures.mts`, and `invariant.mts` each import
  `admissibility` and `assert`; an import between them (or a shared helper that
  forces one to reach another) makes the composition rules impossible to read
  independently, and it is what produced the `descriptorType` duplication that the
  helpers `ensuresArgs`, `rescueArguments`, and `attemptRescue` exist to remove.
- **A contract module must not know about a feature kind.** `assertDemands` is
  called from three different lifecycles and cannot tell which. A `descriptorType`
  or `FeatureKind` parameter leaking into a contract signature is a finding: the
  contract describes `P` or `Q`, and the *lifecycle* knows where the boundary is.
- **Leaf utilities stay leaves.** `assert.mts` and `AssertionError.mts` must not
  import `Contracted`. A cycle there would make the error type depend on the class
  it reports on.
- **A decorator must route through `assertFeatureContractTarget`.** It is the one
  place the "methods/getters/setters, non-static, non-private, on a `Contracted`
  subclass" rule lives. A decorator that re-implements part of it will drift.
- **`index.mts` is a re-export barrel and nothing else.** Logic in the barrel is a
  finding; it changes import order semantics for every consumer.

**Is this duplicated shape, or a genuinely separate contract?** A duplicated
*rule* is a finding regardless of form: two copies of a composition rule, a
boundary decision, a trap predicate, or a diagnostic format will drift.

- **The composition rule belongs to the contract, not to the arm kind.** OR for
  `@demands`, AND for `@ensures` and `@invariant`, written once in each module. A
  change that duplicates the loop because a schema arm "needed something different"
  has missed `evaluateArm`.
- **A repeated diagnostic is a missing helper.** `describeViolation` and
  `violationError` exist so three contracts report identically. A fourth
  hand-built message will diverge in exactly the field a consumer reads.
- **A repeated boundary decision is a finding.** The "a getter's subject is its
  result" rule was written four times before `ensuresArgs` and `rescueArguments`
  named it. A new `descriptorType === 'get' ? … : …` inline is the same defect
  returning.
- **Three copies is a missing abstraction.** Two similar blocks may be
  coincidence; state which of the two or three you are reporting.

## 12. Pass G — library and API design

Pass F asked *is this in the right module*. Pass G asks *is this the right contract
to publish*, and it judges the change against qualities no single file can show.

**Read the change as a consumer would.** The consumer installs the package, writes
`class Foo extends Contracted`, decorates a method, and calls `Foo.new()`. Anything
you approve ships into that author's class, under their bundler, on their Node
version. Ask these in order.

**1. Public surface.** Every export in `src/index.mts` is a promise. A new export
is new API: does it need to be public, or is it an implementation detail that
happens to be exported? A narrowed or removed export is a breaking change. The
`dist/*.d.mts` files are the contract the consumer's compiler reads — a `.mts`
change that alters inference is an API change even when no runtime code moved.

**2. What a consumer cannot change.** The library proxies *their* class, so it
cannot require them to declare a constructor, avoid `#private`, avoid a getter, or
use a particular bundler. A feature that only works if the consumer restructures
their class is a finding about ergonomics, not a feature. Say what the consumer
must give up.

**3. Composition and variance.** The library's best idea is that a subtype may
weaken `@demands` (OR) and strengthen `@ensures` (AND) without writing anything.
A change that makes the composed behaviour depend on declaration order, on the
number of arms, or on which arm happens to run first is a finding unless it is
documented — and it usually is not, because the rule reads as obvious until a
consumer's arm is unreachable.

**4. Diagnostics are API.** `ContractViolation` is a published structure, and its
fields are read by error boundaries and by metadata-driven tests. A new failure
that produces an `AssertionError` with no `violation`, or a field whose value
depends on the bundler (`constructor.name`), is a finding: the consumer's code
compiles and then misroutes.

**5. The boundary is the design.** Where `@ensures` runs is a decision, and it
differs per feature kind. A change that makes an `async` feature throw
synchronously, or a generator check only at completion, changes the observable
behaviour of every consumer's class. State the rule, then check the change against
all four kinds.

**6. Cost.** The library runs on every call. `@invariant` is evaluated twice per
accessor read and twice per set; a three-term invariant measured ~1.7 us per call.
A change that adds an allocation, a `WeakMap` lookup, or a `Proxy` per *call* rather
than per instance is a cost finding, not a style one. Say which path pays it.

**7. Trust boundary.** The traps are the security boundary, and a consumer's
security decisions rest on them. A gap is an authorization hole in someone else's
application, not a missing nicety. Treat a trap gap as High even when no test in
this repo would notice.

**8. Operability.** When a contract fails in a consumer's production build, does
the message still name the class and the feature? Minification renames classes;
`AssertionError.name` is set explicitly for exactly this reason. A new error or
diagnostic that depends on a name the bundler can change removes the consumer's
only signal.

**9. Recorded decisions.** A library's comments *are* its design record, because
there is no `_docs/` and no architecture decision log. If a change chooses one
behaviour over another — which arm wins, what a retry re-enters, whether a
predicate sees the raw object — the comment must say why. A docblock stating a
rule without its reason will be "fixed" into a contradiction by the next
contributor.

**10. Irreversibility.** Rank by how hard the decision is to undo. A published
export, a declared type, and a `ContractViolation` field are permanent in practice:
consumers depend on them and semver makes removal expensive. A comment or an
internal helper is cheap. Spend your strongest language on the irreversible end.

A structural concern is not automatically a defect. When the shape is defensible,
say what it trades away and move on. When it is not, name the alternative and the
cost of taking it.

## 13. Pass H — instruments, harnesses, and measurements

**Any change set that cites a measurement must be reviewed for the validity of
that measurement, not only for the quality of its code.**

This pass exists because instruments fall through every other pass. A harness is
not product code, so A and B do not fit it; it is not a test, so C′ does not fit
it either. The result is a file that gets reviewed as ordinary software — its
error handling, its naming, its TLS options — while the question that matters goes
unasked: **does this instrument actually create the condition it claims to
measure?**

It applies to `.devcontainer/*`, `webpack.config.mjs`, the repository-hygiene
tests (`build-hygiene`, `ci-config`, `devcontainer`, `packaging`), the scripts under
`../scripts/`, and any file whose output is quoted as evidence
in an issue or a PR body. If a change claims "measured", find the thing that
measured it and review it here. A number whose instrument you never opened is a
number you cannot cite.

**The mutation harness is itself an instrument, and it has a trap this repository
sets for it.** The tests import the library by its package name, and the `exports`
map resolves that to `dist/`. A mutation written to `src/` is invisible to the suite
until `npx webpack` regenerates the bundle; a harness without that build step
reports every mutation as SURVIVED, which reads as "the tests are vacuous" when the
truth is "the harness measured the previous build". Check the harness runs the build,
and that it does not run `npm run build`, whose `prebuild` hook lints and would reject
a mutation for being unused rather than testing it.

Ask these five, in order:

**1. Does the driver instantiate the treatment?** The measurement claims a
condition held. Find the line that creates it. A harness that claims "the requester
left and the group kept talking" must actually make a participant leave, and the
survivors must actually hold whatever the mechanism requires.

**The probe is not the product.** A harness that drives a measuring page proves
what that page does, not what the shipping surface does. Enumerate every behaviour
the claim depends on, then check that the page it drives performs each one. A
behaviour supplied by a component the harness does not load — the `get` trap's
wrapper, the `old` snapshot, the read-only view — is simply absent from the run, and
the
measurement measures its absence.

**The negative control is the whole experiment.** If the claim is "X survives
the loss of Y", the run must first establish that X was present **while Y was** —
and the mechanism must be one where losing Y would plausibly have ended X. A run
in which the only holder of the mechanism IS Y measures the case the specification
says cannot happen, and any positive result from it is a different phenomenon.

**2. Can the clock distinguish the hypothesis from its alternative?** For every
temporal claim, name the two moments being compared and where each timestamp comes
from. Delivery time is not speech time. Acceptance time is not the event's time.
A recorded "at" is only evidence about the moment it was captured, and a claim
about an earlier moment needs evidence captured then.

State the alternative hypothesis explicitly: *if the mechanism had failed, what
would this run have looked like instead?* If the answer is "the same", the run
cannot distinguish the two and proves nothing.

**3. Is a failed read distinguishable from a negative result?** An instrument that
reports `0` both when the world is empty and when its own read broke is not an
instrument. Check the failure path: a missing file, a refused connection, a
non-200, an unparseable body, an empty result. Each must be a **different**
verdict from a genuine zero, and the driver must exit non-zero on the
indistinguishable ones.

**4. Does the verdict follow from the evidence, or from a proxy?** Read the
condition that decides success. A count is not a verdict: "N events arrived" cannot
tell a complete run from a truncated one, a correct attribution from a shuffled
one, or speech after a departure from a late delivery of speech before it. The
verdict must test the property the claim is about — and must be able to FAIL for
the right reason, not merely for the absence of data.

**5. Does the artifact's name and its fields match what it holds?** A fixture
called `departure` that stores a last utterance will be read as a leave time by
everyone downstream, including the next test. Read the fixture's own metadata: does
its `_limits` note describe the same limitation you just found, or does it
contradict it? A fixture whose documentation disclaims a conclusion while a test
asserts that conclusion is a finding against the **test**.

Report a validity defect as a test-adequacy finding with the note
`_Test adequacy · Pass H_`, and rate it by what the claim is load-bearing for: a
measurement cited as the sole proof of a milestone criterion is **High**, because
the criterion is unproven rather than merely weakly supported.
