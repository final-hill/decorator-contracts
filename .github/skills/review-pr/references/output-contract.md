# Output Contract

The shape of the review this skill produces. Read this when you reach step 14,
not before. The severity of a finding is in `rubric.md`; this file is about form.

**Report findings only.** Do not modify a file, stage anything, or create a branch
or pull request as part of the review. A review that quietly edits the tree is no
longer a review of what the author wrote.

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
