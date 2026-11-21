# `mutate.mjs` — the mutation check's mechanics

The skill says *when* and *why* to mutate; this file says *how to invoke it*.
Consult it at the moment of use, not while planning the review.

## The build runs first

The tests import the library by its package name, and the `exports` map resolves
that to `dist/`. The mutation is written to `src/`, so the harness rebuilds with
`npx webpack` before running the suite. Without that step every mutation reports
SURVIVED against the previous bundle — a false negative that reads as vacuous
tests. `webpack` is called directly rather than `npm run build`, because the
`prebuild` hook lints and would reject an unused mutation instead of testing it.

## The command

```bash
node .github/skills/pr-review/scripts/mutate.mjs \
  --file src/admissibility.mts \
  --test src/tests/standard-schema.test.mts \
  --find "    if (!options?.normalize || isSchema(arm)) return;" \
  --replace "    return;" \
  --name "predicate normalization is refused"
```

It applies ONE edit, runs the named suite, and restores the file on every path,
including a signal — so it is safe to run mid-review.

## The exit code is the verdict

| Exit | Meaning | What you do |
|---|---|---|
| `0` | **CAUGHT** — the suite goes red without the code | The assertion is load-bearing **for the input you mutated**. It says nothing about the inputs you did not mutate. Cite it as one dimension, and go mutate the rest. |
| `1` | **SURVIVED** — the suite is green either way | The criterion is **UNMET** — at least for that input, and that is enough to file it. |
| `2` | The check could not run — already-red baseline, missing or ambiguous `--find`, or the mutated suite never executed | Fix the invocation. The result proves nothing either way. |

## Flags

- **`--find` must be unique.** The script refuses unless the literal occurs
  exactly once, because an ambiguous find is a silent *wrong* mutation. Pass
  enough surrounding text (indentation included) to name one site.
- **`--dry-run`** validates the find string without touching the file.
- **`--skip-baseline`** trades the safety run for speed.
