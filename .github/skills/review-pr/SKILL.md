---
name: review-pr
description: 'Review pending changes as a senior engineer and a library API designer would: spec conformance, test adequacy (whether an assertion can fail, whether the fixture reaches the branch), mutation-harness validity, contract semantics, encapsulation completeness, re-entrancy and failure handling, public API and type-surface impact, packaging, and trade-off recording. Use when: reviewing your own work before committing, reviewing pending git changes, reviewing a branch or pull request diff, checking for violations of the repo copilot instructions, finding duplication or layering violations, assessing the API impact of a change, checking whether the tests actually prove the acceptance criteria, checking whether a mutation result is valid, finding functions whose real complexity is hidden in nested closures, finding stale or orphaned docblocks after a refactor, or getting a second opinion on a change set. Do NOT use for: fixing the findings (use the default agent), or for style and formatting (lint owns that).'
argument-hint: 'Optionally name a base branch, PR number, or path to focus on'
---

# Pull-Request Review

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

Run **every** pass. This is a complete review; never skip a pass because the
change set looks small or obviously fine — the cheap passes are the ones that
catch the expensive mistakes.

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

**Narrow the change set when the invocation names a scope** — a base branch, a PR
number, or a path. Pass it to the collector as `--base <ref>`, or review only the
named path. With no scope given, review everything pending.

Run the collector. It resolves the base, layers committed work on top of pending
work, and folds in untracked files:

```bash
node .github/skills/review-pr/scripts/collect-diff.mjs
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
node .github/skills/review-pr/scripts/fetch-spec.mjs
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
  rules (present behaviour only, never how the code got here), the commit and
  version-bump rules, the encapsulation invariants, the entry/exit boundary per
  feature kind, and adjacent/orphaned docblocks.

The instructions feed Pass E. Pass G reads the *library*, not the instructions:
the public exports in `src/index.mts`, the trap surface in `src/Contracted.mts`,
the composition rules in `src/demands.mts` / `src/ensures.mts` /
`src/invariant.mts`, the read-only view in `src/read-only.mts`, and the contract of
the emitted `dist/*.d.mts`.

**Decide now whether Pass H applies.** It does whenever the change set cites a
measurement — a timing, a count of call sites, a coverage figure in a plan, an
issue, or a PR body — or touches `scripts/`, `.devcontainer/`, or the
`.github/skills/review-pr/scripts/` harness itself. Note the files, and review them
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
- **Line endings.** Every text file is LF, enforced by `.gitattributes`
  (`* text=auto eol=lf`) and `.editorconfig`. A change that introduces CRLF, or
  converts a file's endings as a side effect, produces a diff nobody can read.
  Check `git diff --stat`: a one-line change showing hundreds of lines is this
  defect.

### 5. Pass A′ — structural probes the linter cannot see

Run the probe over the change set:

```bash
node .github/skills/review-pr/scripts/check-structure.mjs --changed
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

### 6–13. Passes B through H

Each pass asks its own question and reports findings its own way. Read one pass at a
time from `references/passes.md` — its heading is the pass number and name, so reach
it in the order below and do not read ahead.

| Pass | Asks |
|---|---|
| **B** — re-entrancy, trap interaction, lifecycle | *What does this change newly make TRUE, and what ENFORCES it?* What happens on the second call, when the body rejects, when it yields? |
| **C** — spec conformance | Is every path that can produce a criterion's outcome correct — not only the path the spec describes? Cite the decision ID. |
| **C′** — test adequacy | Can the assertion fail, does the fixture reach the branch, and was **each** independently-variable input mutated? |
| **D** — propagation | Does the change hold at every call site, including the callee the diff never touches? |
| **E** — house-rule conformance | Does the change break an instruction in `.github/copilot-instructions.md`? Quote the rule. |
| **F** — module boundaries and duplication | Does the dependency point one way, and is this duplicated *shape* or a genuinely separate contract? |
| **G** — library and API design | Is this the right contract to publish, and does it hold as a consumer uses it? |
| **H** — instruments, harnesses, measurements | Does the evidence bear the claim made from it? |

Three of these carry a rule that the skill depends on and that is easy to skip:

- **Pass C′ starts with the observable, not the test.** Name the value that would
  differ if the implementation were wrong, *then* find the assertion that reads it.
  A criterion mapped to a file name is unmapped.
- **Pass H applies whenever the change set cites a measurement** — and then it is not
  optional. A green suite and a killed mutation both verify code; neither verifies an
  experiment.
- **Pass E quotes the instruction it finds broken.** A conformance finding that cannot
  quote a rule is an opinion.

### 14. Write the review

Follow `references/output-contract.md`. Read `references/rubric.md` for the severity
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

See `references/output-contract.md`. It defines the verdict line, the finding form,
the API Impact section, and the anti-patterns, and it opens with the one rule that
bounds the whole review: **report findings only.** Do not modify a file, stage
anything, or create a branch or pull request as part of a review.
