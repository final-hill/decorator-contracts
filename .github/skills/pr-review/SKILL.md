---
name: pr-review
user-invocable: false
description: 'Review pending changes as both a senior engineer and a library API designer would: house-rule conformance, spec conformance, COMPLEXITY HIDDEN IN NESTED CLOSURES (whether a function is an orchestrator whose branching lives in anonymous callbacks, which the lint rule cannot count), ADJACENT AND ORPHANED DOCBLOCKS (whether a scripted edit left a comment describing the wrong symbol or nothing), TEST ADEQUACY (whether an acceptance criterion is proved by an assertion that can fail, and whether the fixture actually reaches the branch), MUTATION HARNESS VALIDITY (whether a mutated src/ file is actually what the suite loads, given that tests import the built package), CONTRACT SEMANTICS (whether composition, variance, and the entry/exit boundary still hold), correctness under re-entrancy, thenables, and failure (including whether a new guard is keyed as widely as the rule it enforces), identity and matching (dedupe keys, property-name conventions, proxy/raw identity), multi-pass state (retry, rescue, generator resumption), ENCAPSULATION COMPLETENESS (whether every reflection path into the instance is trapped), cross-file propagation, public API and type-surface boundaries, packaging and build hygiene, and trade-off recording. Use when: reviewing your own work before committing, reviewing pending git changes, reviewing a branch or PR diff, checking for violations of the repo copilot instructions, looking for duplication or layering violations, assessing the API impact of a change, checking whether the tests actually prove the acceptance criteria, checking whether a mutation result is valid, finding functions whose real complexity is hidden in nested closures, finding stale or duplicated docblocks after a refactor, or getting a second opinion on a change set. Do NOT use for: fixing the findings (use the default agent), or for style/formatting (lint owns that).'
argument-hint: 'Optionally name a base branch, PR number, or path to focus on'
---

# Pull-Request Review

<!--
No slash command of its own: `/review-pr` is the single entry point, and it reads
this skill. Two commands for one workflow (this folder's name and the prompt's)
is a duplicate surface with two names to remember. Auto-loading by description
still works, so the model can reach for this skill unprompted.
-->

Produce the review a **senior engineer and a library API designer** would leave
on a PR, not a summary of the diff. The diff is evidence, never the subject.

Two lenses, and they answer different questions. Keep them apart, because
conflating them produces findings that are wrong for their own frame:

| Lens | Question | Passes |
|---|---|---|
| **Senior engineer** | Is this code correct, consistent, and well-factored? | A, A′, B through F, C′ |
| **Library API designer** | Is this the right contract to publish, and does it hold as consumers use it? | G |
| **Experimenter** | Does the evidence bear the claim being made from it? | H |

A defect is a defect. A structural concern is a decision someone made, and the
designer's job is to make sure it was made **deliberately and on the record** —
not to demand a rewrite.

The third lens applies only when the change set cites a measurement, but then it
is not optional: **a green test suite and a mutated assertion both verify code, and
neither verifies an experiment.**

## What this library is, for the reviewer

This package is not an application. It has no routes, no database, no tenancy.
It is a **contract runtime**: a `Proxy` that brackets every public feature of a
class with `@invariant`, `@demands`, `@ensures`, and `@rescue`, at a boundary
chosen by the feature's kind (`sync`, `async`, `generator`, `async-generator`).

Three consequences follow, and they replace most of what an application rubric
would tell you to look for:

- **The public surface is the product.** A method or a declared type that
  reaches consumers cannot be changed cheaply. Review exported signatures,
  `package.json` `exports`, and the emitted `.d.mts` as carefully as logic.
- **Every trap is a security boundary.** Encapsulation, the read-only predicate
  view, and the metadata record are what the guarantees are made of. A gap in a
  trap is not a missing nicety; it is a false guarantee.
- **The library proxies other people's classes.** It cannot assume anything
  about what a consumer's body does, which subclass it is, or what bundler
  compiled it. Anything that depends on such an assumption is a finding.


## Ground Rules

1. **Never report what lint, typecheck, or the compiler already report.** Formatting,
   indentation, naming, trailing commas, and unused imports are not findings.

   This applies to rules and not to *invariants*. `@typescript-eslint/no-explicit-any`
   is off, `no-unused-vars` is a warning with an `_`-prefix escape, and the config
   enforces no complexity budget at all — so a repetition of any of those adds
   nothing. But lint cannot see that an external write escaped a trap, that a
   predicate was handed the raw instance instead of the read-only view, that a new
   decorator skipped `assertFeatureContractTarget`, or that a declared type no
   longer matches what the decorator registers. Those are exactly the findings this
   review exists for. When a house rule has a lint counterpart, **assume lint
   passed and move on**; when it has none, check it every time.
2. **Every defect must be verified.** Run the probe, apply the mutation, read the
   trap. If you cannot verify it, phrase it as a question, not a claim. An
   unverified claim is worse than silence. This binds the designer lens too: cite
   the trap, the declaration, or the call site.
3. **Say nothing positive.** No "nice refactor", no restating what the diff does.
   The author can read their own diff.
4. **Report one finding per defect.** If the same defect appears at several sites,
   say so once and list the sites.
5. **A clean review is an allowed outcome.** Do not invent findings to seem useful.
6. **A conformance finding names the rule it breaks.** Quote the instruction or
   name the invariant, so the author can appeal to the rule instead of to your
   taste.
7. **A test proves a criterion only if it can fail.** A criterion mapped to a file
   name, or to a test whose fixture never reaches the branch, is UNMET. Say which
   assertion would fail and under what mutation; if no assertion would, the
   criterion is unverified and that is the finding. See Pass C′.

   **AND A CAUGHT MUTATION DOES NOT MAKE IT PROVEN.** Killing a mutation proves an assertion is not vacuous. It says nothing about whether the assertion
   is **complete** — whether it reads the whole observable the criterion depends
   on. One killed mutation is one dimension checked. Pass C′ requires an
   observable first and a mutation per independently-variable input.
8. **The author's own plan is not the spec.** When a plan, a design note, or the
   issue body carries the author's reasoning, treat it as a claim to check, not as
   the requirement. Audit against the issue's acceptance criteria; a plan asserting
   "criterion met → symbol X" is the very thing to verify.

   This binds the plan's **measurements** too. A plan reporting "305 decorator call
   sites across 24 files" is a claim, not evidence. Trace each number to a command
   you can re-run. A number you cannot trace is a question, not a ✅.
9. **Evidence must be able to distinguish the defect from the design.** Nothing is
   PROVEN, ✅, or VERIFIED unless you can name the observation that would have
   looked DIFFERENT had the implementation been wrong. If the evidence you are
   looking at is equally consistent with both, it proves nothing, and saying so is
   the finding. See Pass H.
10. **A claim about the runtime is a claim to verify.** An assertion that something
    is *impossible*, *unobservable*, *safe*, *identical*, or *supported* is a claim
    about the platform or the build, and it is checkable. Ground rule 8 binds a
    plan's **numbers**; this binds its **assertions**, which is the wider category —
    "a frozen instance still runs its features" has no number to trace, which is
    exactly why it slips through.

    For this library the runtime is Node, the `Proxy` specification, and the
    consumer's transform. Open the thing that decides the claim and answer it in a
    scratch file: does `Object.freeze` really leave the method wrappers working, is
    `Reflect.set` with the proxy as receiver really safe alongside a
    `defineProperty` trap, does a subclass field initializer really land on the
    object the constructor returned. Then apply the specification's own semantics —
    a non-configurable own property cannot be reported differently by a `get` trap,
    and a private field is reachable only through the object that owns the slot.
    Cite the probe output, the file, and the line.

    **The failure mode is confident pessimism AND confident optimism.** A docblock
    declaring something impossible needs a probe as much as a numeric claim needs a
    traceable artifact. Declaring a feature unsupportable when a small change would
    support it abandons work the maintainer could have shipped; declaring it safe
    when it is not is worse. Both are the same defect: a runtime premise asserted
    rather than measured.

## Procedure

### 1. Establish the change set

**This review runs before the pull request exists.** It needs no PR, no pushed
branch, and no network access. Do not ask for one, and do not create one.

Run the collector. It resolves the base, layers committed work on top of pending
work, and folds in untracked files:

```bash
node .github/skills/pr-review/scripts/collect-diff.mjs
```

It prints the summary and writes the full patch to a temp file, so a large change
set can be read in pieces instead of flooding one response. Pass `--base <ref>`
only when the default branch point is wrong.

What the modes mean:

| State | Mode | Review |
|---|---|---|
| Uncommitted or untracked work | `worktree only` | The ordinary pre-commit case. Untracked files are new code; read them as carefully as the diff. |
| Commits on a branch, PR open or not | `branch + worktree` | Both layers. A commit made halfway through the task is still part of the change set. |
| Detached or shallow clone | any | The script falls back through `origin/HEAD`, `origin/master`, `master`, `origin/main`, `main`. |

If the collector cannot run, do it by hand with the same three parts:

```bash
git status --porcelain          # the untracked files `git diff` will never show
git diff HEAD                   # everything tracked that is not committed
git log --oneline <base>..HEAD  # committed work, if any
```

### 2. Load the spec — do this before reading a single hunk

This is the step that separates a real review from a diff summary. A change
almost always answers a written requirement, and **the requirement is not in the
diff**.

Run the spec collector. It finds the PBI reference locally, then asks `gh` for the
issue body:

```bash
node .github/skills/pr-review/scripts/fetch-spec.mjs
```

The reference is recovered strongest-signal-first, all before anything is pushed:

1. `--issue <n>`, when you were given one.
2. The branch name. The house convention is `<user>/issue<number>`.
3. A commit subject or body: `Fixes #1793`, `Refs #1793`, `PBI #1793`.
4. A local design note whose filename contains the number.

**The script's exit code is the instruction:**

| Exit | Meaning | What you do |
|---|---|---|
| `0` | The PBI was fetched | Read the file. Its numbered decisions (D1, D1a, D2) and acceptance criteria are the review's checklist. |
| `1` | No reference was found | Review for correctness only. |
| `2` | A reference was found but the PBI could not be fetched | **Tell the user, prominently, what to run.** Then review for correctness only. |

On exit `2` the script prints the remedy to stderr, usually `gh auth login` or
`gh auth refresh -h github.com -s repo` for a missing scope. **Relay it.** Do not
silently proceed: a review without its spec cannot check conformance, and the
user needs to know that the review is weaker than it looks.

Whatever the exit code, write the decisions down as a list **before** reviewing,
and cite them by ID in the findings. That lets the author check your work against
the requirement rather than against your opinion.

If a local plan or design note exists, the script lists its path rather than
inlining it. Read it; it may carry the design rationale the issue omits, but see
ground rule 8 — it is a claim, not the requirement.

If no spec exists, say so in the verdict and review only for correctness. Do not
invent requirements.

### 3. Read the house rules

Read `.github/copilot-instructions.md` and skim `eslint.config.js`. The
invariants that a generic reviewer will miss are recorded there, and the recurring
traps are in `references/rubric.md`.

Separate the instructions into two lists as you read, because they are checked in
different passes and reported with different labels:

- **Enforced by lint**, so already true of anything that reaches you: naming,
  indentation, unused imports, trailing commas. Do not check these and do not
  report them. Note that this config is deliberately thin —
  `@typescript-eslint/no-explicit-any` is **off** and there is **no `complexity`
  rule**, so do not assume a budget is enforced that does not exist.
- **Enforced only PARTIALLY by lint**, so run the structure probe in step 5:
  complexity-in-nested-closures and docblock integrity. Neither has a lint
  counterpart here at all.
- **Not enforceable by lint**, so only this review catches them: the comment
  rules (no history lessons — the only rule currently in the instructions file),
  the encapsulation invariants, the entry/exit boundary per feature kind, and
  adjacent/orphaned docblocks.

The instructions feed Pass E. Pass G reads the *library*, not the instructions:
the public exports in `src/index.mts`, the trap surface in `src/Contracted.mts`,
the composition rules in `src/demands.mts` / `src/ensures.mts` /
`src/invariant.mts`, the read-only view in `src/read-only.mts`, and the contract of
the emitted `dist/*.d.mts`.

**Decide now whether Pass H applies.** It does whenever the change set cites a
measurement — a timing, a count of call sites, a coverage figure in a plan, an
issue, or a PR body — or touches `scripts/`, `.devcontainer/`, or the
`.github/skills/pr-review/scripts/` harness itself. Note the files, and review them
as experiments rather than as software. A claim asserting "measured" without a
harness you can open is itself the finding.

**Decide also whether ground rule 10 applies.** It does whenever the change set
*asserts* something about the runtime — that a reflection path is impossible to
reach, that a proxy preserves identity, that a construct works under `freeze`,
that a bundler keeps a name. Note the assertion; each one is a probe.

### 4. Pass A — mechanical and verifiable

These findings are the cheapest and the most convincing, because they are facts.

- Argument arity and order at every changed call site, especially the internal
  ones: `evaluateArm(arm, subjects, contract, label, index, options)`,
  `violationError(...)`, and `runLifecycle(descriptorType, ...)` each take ordered
  positional arguments that an edit silently reorders.
- Nullable values dereferenced, or passed where the callee does not accept null.
  `populateOld` returns `undefined` when checked mode is off while `assertEnsures`
  takes `old: Contracted`; a call site that assumes the snapshot exists is a
  finding.
- **A function that IMPLEMENTS A STANDARD — go read the standard, not the code.**
  This applies to the decorator protocol (`Symbol.metadata`, the stage-3 decorator
  context) and to `StandardSchemaV1`. The question is not "is this internally
  consistent" but "is this what the specification says".

  **SELF-CONSISTENCY IS THE TRAP.** A test that exercises the library against
  schemas the library itself authored proves the two halves agree, not that either
  is right. The same holds for `Symbol.metadata`: the repo polyfills it in
  `src/types.mts`, so a test asserting the polyfill's shape cannot detect a
  divergence from the proposal.

  Examples of the shape, not a checklist: `StandardSchemaV1` is **invariant** in
  `Input`, so a type pinned to `any[]` rejects real providers; the decorator context
  `kind` is one of `'method' | 'getter' | 'setter' | 'field' | 'accessor'`, and a
  decorator that assumes `'method'` breaks the rest; a validated value replaces the
  subject only when the arm asks for it.

  **And a confident docblock arguing for the wrong behaviour is not evidence — it
  is the thing to check.** Verifying *why* the code diverges belongs here, not in a
  later pass.
- **Every public export is a compatibility promise.** Open `src/index.mts` and
  compare it against `package.json` `exports`. A new export is public API; a
  removed or narrowed one is a breaking change and the version bump must say so.
- **The declared types must match what the decorators register.** The
  `Contracted[Symbol.metadata]` declaration is a public type. A decorator that
  stores `{ arm, options }` while the declaration says `Predicate[]` compiles on the
  producer's side and throws at the consumer's. Check the declaration against the
  registration site, not against itself.
- **A trap must cover every door onto the same mutation.** `set`,
  `defineProperty`, `deleteProperty`, and `setPrototypeOf` are four doors onto one
  invariant, and a guard added to one and not the others is the recurring defect in
  `src/Contracted.mts`. Enumerate the doors, then check each.
- **The read-only view must be at least as strict as the instance.** A predicate
  receives the proxy from `src/read-only.mts`. If the instance traps an operation the
  view does not, a predicate can do what a caller cannot.
- **A kind dispatch must be exhaustive.** `featureKindOf` returns one of four kinds
  and `runLifecycle` dispatches on them. An unrecognised constructor falls through
  to `'sync'`; check that the fallback is intended and that the thenable guard is
  what fails it.
- **Does the change work from a clean tree?** `dist/` is git-ignored and generated.
  A change that only works because a stale `dist/` happened to be present is a
  finding; `npm run build` from clean is the check.
- **Packaging.** `files` publishes `dist` only. A change that expects a source file,
  a README fragment, or a `.d.mts` webpack does not emit will not reach a consumer.
- **Line endings.** `src/**/*.mts` are LF; `README.md`, `package.json`,
  `tsconfig*.json`, and `.github/**` are CRLF. A wholesale rewrite that normalises
  either direction produces a diff nobody can read. Check `git diff --stat`: a
  one-line change showing hundreds of lines is this defect.

### 5. Pass A′ — structural probes the linter cannot see

Run the probe over the change set:

```bash
node .github/skills/pr-review/scripts/check-structure.mjs --changed
```

It reports two things lint cannot, both of which were found by hand repeatedly
during a large refactor — several times each, always after the suite was green.

**1. Complexity hidden in nested closures.** Every function is reported twice:
`own` counts branches in the body and is what the gate measures; `total` counts
branches including nested closures. A function with a low `own` and a far higher
`total` is an orchestrator whose difficulty the signature does not show — the
work is in anonymous callbacks, and that is the shape to split. Report a row when
`own` reaches the gate, or when the hidden delta is large enough to matter.

A **declarative data table is not this** — a factory returning an array of objects
whose members each carry one ternary has `own` = 1 and a high `total` while being
trivially readable. The probe applies an `own` floor for that reason; when a row
survives the floor, the finding is real. Do not report the table.

**2. Adjacent and orphaned docblocks.** A scripted move (extract method, relocate
a block, append a module) leaves one docblock stacked on another, or a docblock
stranded above a closing brace. The result compiles, lints, typechecks, and passes
every test — the comment now describes the wrong symbol, or nothing. Both shapes
are reported, and both are findings: a docblock that documents nothing is worse
than absent, because it reads as authoritative.

The probe compares against the baseline (`HEAD` by default) so a pre-existing wart
is not reported as this change's defect. Report only what survives that — and when
the baseline is what hides a real problem introduced *inside* a pre-existing
block, say so, because the baseline cannot tell those apart.

**What this pass does not cover.** It is textual and structural. It cannot see
that a comment states something FALSE about the code it describes. That is a
reading task: when a docblock carries a rationale, check the rationale against the
body, exactly as ground rule 8 requires for a plan's claims.

### 6. Pass B — re-entrancy, trap interaction, and lifecycle

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

### 7. Pass C — spec conformance

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

### 8. Pass C′ — test adequacy

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
|---|---|
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
|---|---|
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
obvious the code looks. Run it with `scripts/mutate.mjs`; its invocation, exit
codes, and flags are in `references/mutation-harness.md`.

"I believe this holds" is not a verdict. "Removing the cancellation makes this
assertion fail" is. "Removing the cancellation fails this assertion, but passing
`false` instead of `true` does not" is the honest one.

**A missing test is a finding, not a question.** Name the branch, name the
mutation, and file it.

### 9. Pass D — propagation

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

### 10. Pass E — house-rule conformance

`.github/copilot-instructions.md` is currently short: a rule about comment style,
and a rule about the git workflow. Read it anyway, bullet by bullet — it is the
source of truth, and this table is only a convenience.

| Instruction | Verify | Lint sees it? |
|---|---|---|
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

### 11. Pass F — module boundaries and duplication

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

### 12. Pass G — library and API design

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

### 13. Pass H — instruments, harnesses, and measurements

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
`.github/skills/pr-review/scripts/`, and any file whose output is quoted as evidence
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

### 14. Write the review

Follow the output contract below. Read `references/rubric.md` for the severity
definitions and the failure classes worth hunting in this repository.

**A SECOND REVIEW IS A REVIEW OF A NEW CHANGE SET.** When you have already
reviewed this work and the author has pushed fixes, the fixes are diff you have
never read — and a fix that answers a finding is exactly where a new invariant
enters. Do not re-run only the pass that raised the original finding, and do not
treat a resolved thread as a resolved question. Collect the diff again and run
**every** pass over it.

The recorded instance: a fix that made a derived id the row's primary key turned a
sequential-retry adoption path into a check-then-insert race. Both rounds' findings
were correct; the second round's existed only because the first round's fix created
it.

**THE RULE APPLIES TO FIXES YOU WRITE DURING THE REVIEW, NOT JUST TO FIXES
SOMEONE PUSHES AT YOU.** This is the harder case, because the instinct is to
*prove the fix* — which the mutation check already does — and then stop. Proving a
fix works answers "does this change do what I intended"; it never answers "what
does this change newly make true, and what enforces it".

So: **any code you author in response to a finding is a new change set.** Before
moving on, run Pass A and Pass B over the hunks you just wrote, and state the
answer in one line each:

- *(A)* what did I add, and does every new call site still satisfy arity, nullability,
  and scope?
- *(B)* what does the new code make TRUE that was not true before, and what ENFORCES
  it — and what makes it safe under concurrency, out-of-order arrival, and teardown?

A mutation check passing on a fix is the *precondition* for finishing, not the
finish. If the fix added a guard, a carry, a latch, a cache, or an acknowledgement,
the guard's own key and lifetime are the next question — and those defects are
invisible to the test that pins the happy path.

The recorded instance: a review found that a poll displaced an unsaved viewport
pan, and the fix added a local "carry" released when the save acknowledged. Its own
defects — an ack for frame A clearing the carry holding frame B, a late response
applying after a scope change, a validator recorded before its body was parsed — were
introduced **by the fix**. Four of five findings in that round were defects in the
repair.

## Output Contract

Open with a verdict line, then one sentence of thesis, then the findings.

```text
🟡 Changes recommended — <the single most important sentence>

**N findings:** 2 high, 3 medium, 1 low

### High

**Make the re-entry update atomic and timestamp-monotonic** — `path:line`

<What breaks, in mechanism terms: which two readers, which two writes, what is
lost. One short paragraph, no hedging.>

<The fix, concrete: the statement to use, the lock to take, the constraint to add.>

...
```

Rules for each finding:

- **Title is a verb phrase naming the fix**, not the symptom. "Add the missing
  organization binding", not "Bug in the query".
- **Locate every finding** with `path:line` or `path:start-end`.
- **Explain the mechanism**, then the fix. Two short paragraphs at most.
- **Severity is about consequence**, not about how confident you are. See the rubric.
- **Tag the pass** when the finding comes from Pass E, F, G, or H, so a
  conformance, design, architecture, or validity finding is not mistaken for a
  runtime defect:

```text
  **Trap `defineProperty` alongside `set`** — `src/Contracted.mts:722`
  _Module boundary · Pass F_

  <mechanism, then fix>
  ```

  Use `_House rule: <the instruction>_` for Pass E,
  `_Test adequacy · Pass C′_` for a criterion whose proof cannot fail,
  `_Test adequacy · Pass H_` for a measurement that cannot bear the claim made from
  it, and `_Architecture · <concern>_` for Pass G, where `<concern>` is one of
  ownership, async, failure domain, cost, scaling, data lifecycle, trust boundary,
  operability, or reversibility.

  Quote the instruction for Pass E; do not paraphrase it into something it does
  not say.

**A ✅ on a criterion carries the same burden as a finding.** It is an assertion
that the criterion is met, and it needs the evidence AND the alternative it rules
out. Never write ✅, PROVEN, or VERIFIED for a criterion whose evidence would look
identical had the implementation been wrong — write ⏳ and say what is still
missing. A review that marks an unproven criterion as met is worse than one that
marks nothing, because the ✅ is what the next reader trusts instead of checking.
**THE TEST BEFORE YOU TYPE A ✅: NAME THE OBSERVATION THAT WOULD HAVE LOOKED
DIFFERENT.** Write it down, in the review, next to the verdict:

> *"If the client did not send the header, the trace would show five 200s and no
> `etag` on any request — it shows five 304s."*

If you cannot write that sentence, the evidence cannot distinguish correct from
incorrect **for this criterion**, and the verdict is ⏳ no matter how convincing the
run felt. Two harnesses fail this test in ways that feel like success:

- **An end-to-end run in which both sides are your own code.** Client and server
  agreeing proves they agree, not that either is right. A conformance bug is
  invisible here by construction — the same wrong rule on both sides matches
  perfectly. The distinguishing observation has to come from outside the pair: the
  spec text, an independent client, or a mutation that changes one side only.
- **A UI run that cannot see the state it is judging.** If a product rule means the
  harness can never surface the difference (a renderer that will not re-frame once
  framed, a cache that will not re-render an unchanged value), then the run is
  incapable of failing and proves nothing. Say so, and fall back to the unit-level
  mutation that *can* distinguish it. **Run the negative control**: disable the
  fix and confirm the harness goes red. A harness that passes with the fix disabled
  has measured nothing, and reporting its earlier "pass" as evidence is the exact
  false ✅ this rule exists to prevent.
## API Impact

After the findings, and **only when the change carries API weight**, add a short
section. Omit it entirely for an ordinary defect fix; a section that appears every
time becomes noise.

API weight means at least one of: a new or changed export, a change to a declared
type or its inference, a new trap or a widened one, a change to where the lifecycle
boundary sits for any feature kind, a change to a diagnostic or to
`ContractViolation`, or a change to the supported Node or transform requirement.

```text
### API impact

**Surface.** <One or two sentences: what a consumer now sees that they did not
before, and whether it is additive or breaking.>

**Trade-offs taken.** <What this chooses against. One line each: what was gained,
what was given up.>

**Not decided here.** <The follow-on decisions this defers, and what forces them.
Omit if there are none.>

**Reversibility.** <Cheap, expensive, or permanent, and why. One line.>
```

Rules for this section:

- **Do not repeat the findings.** It is not a summary. If a finding is already
  listed, do not restate it here.
- **Name the trade-off, not the preference.** "Chose a fail-closed invariant over
  a repairable instance" is a trade-off. "Would be nicer with a builder API" is
  not.
- **Say when nothing is owed.** `Reversibility: cheap — an internal refactor with
  no exported shape and no change to the emitted declarations.` is a complete
  answer. Do not manufacture concerns to fill the section.
- **A diverged decision, not a bug.** If the change departs from a documented
  behaviour or a prior design, this is where to say so, with the decision it
  departs from.

When nothing is wrong:

```text
🟢 Approve — no defects found in <N> changed files.
```

Then, and only then, list anything you could not verify as questions.

When the spec was unavailable, say so on the verdict line. A review that could not
check conformance must not imply that it did:

```text
🟡 Changes recommended — <thesis>

Reviewed WITHOUT the spec: issue #1793 was identified but `gh` is not
authenticated. Pass C (spec conformance) did not run. Run `gh auth login`, then
re-run this review.
```

## Anti-Patterns

- "Consider adding a test" without naming the branch that is untested.
- **Accepting a criterion because a test file mentions it.** The question is
  whether an assertion would fail under a defect — not whether the file exists,
  not whether it is green, and not whether the plan says so.
- **Reviewing the implementation against the author's plan instead of the issue.**
  A plan that maps criteria to symbols will always appear to satisfy them; it was
  written by the same head that wrote the code.
- **Treating "the spec says X" as verification when a second path also produces
  X.** Compatibility shims, legacy keys, and backfills can violate a criterion the
  primary path satisfies.
- "This could be a problem if…" with no concrete trigger.
- Restating the diff as a summary.
- Reporting the same class of style issue repeatedly.
- Padding to a target number of findings.
- **Filing a DRY finding you cannot substantiate.** Naming two similar blocks is
  an observation. A real finding names the drift that will follow and the
  derivation to use instead. The reverse also holds: do not excuse a duplicated
  field block as "two contracts" when Zod composition would have shared it.
- **Demoting a finding to a paragraph.** A defect the author documented in a comment,
  a plan, or the PR body is still a defect. Documentation may lower the severity; it
  never removes the item from the findings list.
- **Filing a layering finding the barrel file already routes around.** A component
  importing a type through `#shared/dto` is not reaching into the server.
- **Quoting a house rule the change does not touch.** The checklist is something
  to check, not something to recite.
- **Demanding a rewrite of a defensible shape.** The designer's finding is that a
  decision is unrecorded or its cost is unpaid, not that you would have chosen
  differently.
- **Raising a structural concern in the findings list.** Export surface, cost,
  boundary placement, and reversibility belong in the API Impact section; a finding
  is something that must change before merge.
- **Naming an alternative without its cost.** "Extract a service" is not advice
  until you say what it costs and what it breaks.
