---
description: 'Review pending changes before opening a pull request, as a senior engineer, a library API designer, and (when a measurement is cited) an experimenter. Runs every pass: house-rule conformance, module boundaries and duplication, spec conformance, correctness, propagation, measurement validity, and API impact.'
argument-hint: 'Optional: base branch or a path to narrow the change set'
agent: 'agent'
---

Read and follow the `pr-review` skill at `.github/skills/pr-review/SKILL.md`.

Review through **every lens** the skill defines: the senior engineer (passes A
through F, plus the test-adequacy pass C′), the library API designer (pass G), and
the experimenter (pass H) when the change cites a measurement. The engineer asks
whether the code is correct and well-factored, and whether the tests would actually
catch it being wrong. The designer asks whether this is the right contract to
publish: what a consumer cannot change, whether composition and variance still
hold, and whether the decision it embeds is on the record. The experimenter asks
whether the evidence bears the claim being made from it.

Run **every** pass. This is a complete review; never skip a pass because the
change set looks small or obviously fine — the cheap passes are the ones that
catch the expensive mistakes.

**Pass C′ is not optional and is not satisfied by a green suite.** For every
acceptance criterion in the spec, first name the **observable** that would differ
if the implementation were wrong, then name the assertion that reads that
observable. An assertion on a proxy — a command's name but not its arguments, a
row's presence but not its state, a count but not the attribution — is not proof.

**A CAUGHT MUTATION IS NOT A PROVEN CRITERION.** Killing one mutation shows an
assertion is not vacuous; it says nothing about the inputs you did not mutate.
Mutate each independently-variable input (which command, and with what arguments),
and report a survivor as a finding even when its siblings were caught.

**Pass H applies whenever the change set cites a measurement.** It is not optional
there either. Open the harness that produced the number and ask whether the driver
actually created the condition it claims, whether its clock can separate the claim
from its alternative, and whether a failed read is distinguishable from a negative
result. A harness that drives a probe page does not measure the product; check that
every behaviour the claim depends on is one the probe actually performs.

**Never write ✅, PROVEN, or VERIFIED for a criterion whose evidence would look
identical had the implementation been wrong.** Write ⏳ and say what is missing. A
false ✅ is worse than no verdict, because it is what the next reader trusts
instead of checking.

Include the **API Impact** section when the change carries API weight (a changed
export, declared type, diagnostic, or boundary), and omit it when it does not. Do
not invent structure to fill it.

Narrowing the change set, if given: ${input:scope:optional — base branch or path}

The change set is whatever is pending in the current worktree plus any commits on
this branch. **No pull request is required, and none will be opened.** Collect it
with the skill's scripts:

```bash
node .github/skills/pr-review/scripts/collect-diff.mjs
node .github/skills/pr-review/scripts/fetch-spec.mjs
```

Untracked files are new code and are folded into the diff patch. Review them as
carefully as the tracked diff, because they have never been seen by any reviewer.

**If `fetch-spec.mjs` exits 2, stop and tell the user.** Exit 2 means the PBI was
identified but could not be fetched, nearly always because `gh` needs
re-authenticating. Quote the remedy the script printed (`gh auth login`, or `gh
auth refresh -h github.com -s repo`), say the review will be weaker without the
spec, and only then continue.

Report findings only. Do not modify any file, do not stage anything, and do not
create a branch or pull request.


