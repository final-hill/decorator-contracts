# Copilot instructions

## Code comments

- Describe what the code does **now** and why it is shaped that way.
- Never narrate history: no "previously", "used to", "was unguarded", "this fixes", "no longer", "regression", or references to the bug that prompted the change. That belongs in the commit message and the pull request.
- State a constraint as a fact. Prefer "a prototype setter does not widen this, because ..." over "unlike `set` this was wrong before".
- Comment the non-obvious *reason*, not the obvious mechanics.

## Git

- **Do not commit, push, or create pull requests.** Leave the changes uncommitted in the working tree on the topic branch that is already checked out, and stop. The maintainer reviews the diff and commits it.
- A commit makes the work invisible to a plain `git diff`, which forces extra steps to review it.
- **Always write out the full commit message for the pending changes**, in the reply rather than in a commit. Give it as a fenced block ready to paste into the source-control message box, with the subject line and the body separated exactly as the commit needs them. Any bug history or motivation belongs there rather than in code comments.
- Do not change the package version; the maintainer owns version bumps.
