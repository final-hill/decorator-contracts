# Copilot instructions

## Code comments

- Describe what the code does **now** and why it is shaped that way.
- Never narrate history: no "previously", "used to", "was unguarded", "this fixes", "no longer", "regression", or references to the bug that prompted the change. That belongs in the commit message and the pull request.
- State a constraint as a fact. Prefer "a prototype setter does not widen this, because ..." over "unlike `set` this was wrong before".
- Comment the non-obvious *reason*, not the obvious mechanics.

## Git

- **Do not commit, push, or create pull requests.** Leave the changes uncommitted in the working tree on the topic branch that is already checked out, and stop. The maintainer reviews the diff and commits it.
- A commit makes the work invisible to a plain `git diff`, which forces extra steps to review it.
- **Write the commit message into the source-control box yourself.** Write it to
  `.git/COMMIT_MSG_DRAFT` and point `commit.template` at it, so the message appears
  in the Changes field and the maintainer never copies or pastes:

  ```bash
  git config commit.template .git/COMMIT_MSG_DRAFT
  ```

  The Git extension reads that setting on refresh, so the box fills itself. Do not
  print the message as a fenced block in the reply instead — that is the workflow
  this replaces. Any bug history or motivation belongs in the message rather than in
  code comments.
- The draft lives under `.git/`, so it is never committed and never appears in
  `git diff`. Overwrite it each time rather than appending.
- Do not change the package version; the maintainer owns version bumps.

## Line endings

- Every text file is **LF**. `.gitattributes` normalises on the way in and
  `.editorconfig` makes an editor agree before a file is committed; the project
  targets Linux only, so no working copy wants CRLF.
- Never convert a file's line endings as a side effect of another change. A
  one-line edit that shows hundreds of changed lines in `git diff --stat` is that
  defect, and it hides the real content of the review.
