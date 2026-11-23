#!/usr/bin/env node
/**
 * Collect the review's change set, BEFORE the branch is submitted.
 *
 * Runs on a dirty worktree and on an unpushed branch, because a review is most
 * useful before it becomes a pull request. Three silent failures undermine it:
 *
 * 1. Diffing against a drifted base, which shows other people's commits.
 * 2. Forgetting untracked files. `git diff` never shows them, and on a
 *    not-yet-committed change set that is MOST of the work — new components,
 *    new migrations, new tests.
 * 3. Assuming `origin/master` exists. A fresh clone has it; a detached or
 *    shallow one may not.
 *
 * All three are handled here. Untracked files are folded in with
 * `git diff --no-index`, which reads them without touching the index, so this
 * script never stages anything.
 *
 * Usage:
 *   node .github/skills/review-pr/scripts/collect-diff.mjs
 *   node .github/skills/review-pr/scripts/collect-diff.mjs --base origin/master
 *   node .github/skills/review-pr/scripts/collect-diff.mjs --out /tmp/review.patch
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const args = process.argv.slice(2)

function argValue(name) {
    const index = args.indexOf(name)
    return index === -1 ? null : args[index + 1]
}

function git(gitArgs) {
    try {
        // stderr is captured, not inherited: `git diff --no-index` reports a
        // non-zero exit for every file that differs, and that noise would
        // otherwise be printed as if it were a failure.
        return execFileSync('git', gitArgs, {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        }).trim()
    } catch (error) {
        // `--no-index` exits 1 when the files differ, which is the normal case.
        if (typeof error.stdout === 'string' && error.stdout.trim() !== '') {
            return error.stdout.trim()
        }

        return `!git ${gitArgs.join(' ')} failed: ${error.status ?? '?'}`
    }
}

function hasRef(ref) {
    const result = git(['rev-parse', '--verify', '--quiet', ref])
    return result !== '' && !result.startsWith('!git')
}

/**
 * The base is the branch point, not a fixed name. `origin/HEAD` is where the
 * remote's default branch actually points, so it survives a rename; the rest are
 * ordered fallbacks for a clone that has not fetched.
 */
function resolveBase(requested) {
    if (requested) return requested
    const candidates = ['origin/HEAD', 'origin/master', 'master', 'origin/main', 'main']
    return candidates.find(hasRef) ?? 'HEAD'
}

const base = resolveBase(argValue('--base'))
const out = argValue('--out')

const branch = git(['branch', '--show-current'])
// `-uall` expands untracked DIRECTORIES into their individual files. The default
// collapses a new directory to one entry, which cannot be diffed.
const status = git(['status', '--porcelain', '-uall'])
const ahead = git(['log', '--oneline', `${base}..HEAD`])
const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])

const isGitFailure = (value) => value.startsWith('!git')

const pushed = upstream !== '' && !isGitFailure(upstream)
const committed = ahead !== '' && !isGitFailure(ahead)

// `??` lines are untracked. Paths are repository-relative.
const untracked = status
    .split('\n')
    .filter((line) => line.startsWith('??'))
    .map((line) => line.slice(3).trim())
    .filter(Boolean)

// `git status` renders a path with a space in it as `?? "bar baz"`, so undo the
// quoting before handing the path back to git.
const unquote = (path) => {
    const quoted = /^"(.*)"$/.exec(path)
    return quoted ? quoted[1].replace(/\\(.)/g, '$1') : path
}

const commits = committed ? ahead.split('\n') : []
const mode = committed ? 'branch + worktree' : 'worktree only'

// Worktree state is reviewed ON TOP OF branch state, never instead of it: a
// commit made halfway through a task is still part of the change set.
const branchPatch = committed ? git(['diff', `${base}...HEAD`]) : '(no commits ahead of base)'
const worktreePatch = git(['diff', 'HEAD']) || '(none)'

/**
 * Fold in the untracked files. `git diff` never shows them, and before the first
 * commit they are frequently the substance of the review — new components, new
 * migrations, new tests. `--no-index` reads them WITHOUT touching the index, so
 * this script never stages anything. The comparison is against an empty file, so
 * the whole content renders as additions.
 */
const EMPTY = process.platform === 'win32' ? 'NUL' : '/dev/null'

const untrackedPatches = untracked.map((raw) => {
    const file = unquote(raw)
    const body = git(['diff', '--no-index', '--', EMPTY, file])
    return [`### ${file}`, isGitFailure(body) ? `(could not read: ${body})` : body, ''].join('\n')
})

const diffstat = git(['diff', '--shortstat', committed ? `${base}...HEAD` : 'HEAD'])
const changedFiles = git(['diff', '--name-only', committed ? `${base}...HEAD` : 'HEAD'])
const changed = changedFiles !== '' && !isGitFailure(changedFiles) ? changedFiles.split('\n') : []
const fileCount = changed.length + untracked.length

const list = (values, empty) => (values.length ? values.map((value) => `- ${value}`) : [`(${empty})`])

const sections = [
    '# Change set',
    '',
    `branch:     ${branch || '(detached)'}`,
    `base:       ${base}`,
    `upstream:   ${pushed ? upstream : '(not pushed yet)'}`,
    `mode:       ${mode}`,
    `commits:    ${commits.length}`,
    `untracked:  ${untracked.length}`,
    '',
    '> PRE-PR review: nothing here requires a pull request to exist.',
    '',
    '## Uncommitted status',
    '',
    status || '(clean)',
    '',
    '## Untracked files (folded into the patch below)',
    ...list(untracked, 'none'),
    '',
    `## Commits ahead of ${base}`,
    ...list(commits, 'none'),
    ''
].join('\n')

const patch = [
    sections,
    `## Patch: ${base}...HEAD`,
    branchPatch,
    '',
    '## Patch: uncommitted worktree changes',
    worktreePatch,
    '',
    '## Patch: untracked files (new code, whole-file additions)',
    untracked.length ? untrackedPatches.join('\n') : '(none)',
    ''
].join('\n')

const target = out ?? join(mkdtempSync(join(tmpdir(), 'pr-review-')), 'review.patch')

writeFileSync(target, patch, 'utf8')

process.stdout.write(
    [
        sections,
        '## Summary',
        '',
        `files changed:  ${fileCount} (${changed.length} tracked, ${untracked.length} new)`,
        `diffstat:       ${diffstat || '(none)'}`,
        `patch written:  ${target}`,
        ''
    ].join('\n')
)
