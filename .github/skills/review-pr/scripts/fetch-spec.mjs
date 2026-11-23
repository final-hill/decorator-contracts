#!/usr/bin/env node
/**
 * Fetch the PBI (issue) that a change set answers, so the review can check the
 * code against its requirement instead of against itself.
 *
 * This runs BEFORE the pull request exists. The reference is recovered from the
 * branch name and the commit subjects, which are both local, and only then is
 * `gh` asked for the issue body.
 *
 * Exit codes are the contract:
 *   0  a spec was found and written
 *   1  no spec could be identified (not an error; the review proceeds on
 *      correctness alone)
 *   2  a spec was identified but the GitHub CLI cannot fetch it — authentication
 *      is the usual cause, and the message says exactly what to run
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** The scopes `gh issue view` needs for a private repository. */
const REQUIRED_SCOPE = 'repo'

const argv = process.argv.slice(2)

const readFlag = (flag) => {
    const index = argv.indexOf(flag)
    return index === -1 ? null : argv[index + 1]
}

const run = (file, args) => {
    try {
        return {
            ok: true,
            out: execFileSync(file, args, {
                encoding: 'utf8',
                stdio: ['ignore', 'pipe', 'pipe']
            }).trim()
        }
    } catch (error) {
        return {
            ok: false,
            out: typeof error.stdout === 'string' ? error.stdout.trim() : '',
            err: typeof error.stderr === 'string' ? error.stderr.trim() : String(error.message)
        }
    }
}

const git = (args) => {
    const result = run('git', args)
    return result.ok ? result.out : ''
}

const base = readFlag('--base') ?? 'origin/HEAD'
const out = readFlag('--out')

const branch = git(['branch', '--show-current'])
const subjects = git(['log', '--format=%s%n%b', `${base}..HEAD`])

/**
 * Recover the issue number, strongest signal first.
 *
 * A branch named for the PBI is the most reliable local signal: the house
 * convention is `<user>/issue<number>`, and it is set before any commit exists.
 * A closing keyword in a commit is authoritative too. A bare `refs #N` is weaker
 * — it may point at a related issue rather than the one being implemented — so
 * it is checked last.
 */
const branchPatterns = [
    /issue[-_/ ]?(\d+)/i,
    /PBI[-_/ ]?#?(\d+)/i,
    /(?:^|\/)(\d+)(?:$|[-_/])/
]

const commitPatterns = [
    /(?:fixes|closes|resolves|implements)\s+#(\d+)/i,
    /(?:refs?|part\s+of|depends\s+on)\s+#(\d+)/i,
    /#(\d+)/
]

const firstMatch = (patterns, text) => {
    for (const pattern of patterns) {
        const match = pattern.exec(text)
        if (match) return match[1]
    }

    return null
}

const branchMatch = firstMatch(branchPatterns, branch)
const commitMatch = firstMatch(commitPatterns, subjects)

// An explicit `--issue` wins over every inference. It is how you review against
// a PBI the branch does not name, and how you retry after a failed lookup.
const requested = readFlag('--issue')

const issueNumber = requested ?? branchMatch ?? commitMatch
const matchedOn = requested ? '--issue flag' : branchMatch ? 'branch name' : commitMatch ? 'commit reference' : null

/**
 * A PBI usually has a local plan in `_docs/` named after it. That file is on
 * disk, so it is available without the network: the fallback when the issue
 * cannot be fetched, and a supplement when it can.
 *
 * The plan's PATH is listed rather than its body. These files run to hundreds of
 * lines, and inlining one floods the review's context with a single document
 * that the reviewer can open on demand.
 */
const localPlans = existsSync('_docs')
    ? readdirSync('_docs').filter((name) => issueNumber && name.includes(issueNumber))
    : []

const planSection = localPlans.length
    ? [
        '## Local plans',
        '',
        'Read these at the start of the review. They are on disk and not included',
        'here because of their size:',
        '',
        ...localPlans.map((name) => `- \`_docs/${name}\``),
        ''
    ].join('\n')
    : '## Local plans\n\n(none found in `_docs/`)'

/**
 * Write the document to the file, and print only a short status line. The
 * document itself never reaches stdout: a PBI body plus its plan runs to tens of
 * kilobytes, which would flood the chat and the review's context.
 */
const emit = (document, target, note) => {
    writeFileSync(target, document, 'utf8')
    process.stdout.write([note, `written: ${target}`, ''].join('\n'))
}

if (!issueNumber) {
    const target = out ?? join(mkdtempSync(join(tmpdir(), 'pr-review-')), 'spec.md')
    emit(
        [
            [
                '# Spec: NOT IDENTIFIED',
                '',
                `branch:  ${branch || '(detached)'}`,
                `base:    ${base}`,
                '',
                '> No issue reference was found in the branch name or the commits.',
                '> Review for correctness only, and say in the verdict that no spec was',
                '> available. Do not invent requirements.',
                ''
            ].join('\n'),
            planSection
        ].join('\n'),
        target,
        'No issue reference found. Review for correctness only.\n'
    )
    process.exit(1)
}


const ghAvailable = run('gh', ['--version']).ok

const auth = ghAvailable ? run('gh', ['auth', 'status']) : { ok: false, err: '' }
const authDetail = [auth.out, auth.err].filter(Boolean).join('\n')

// `gh auth status` prints the scopes as one quoted, comma-separated list. Read
// the whole list, not the first token: `/scopes:\s*'([^']*)'/` stops at the first
// quote and would report only `gist`.
const scopeLine = /scopes:\s*(.+)/.exec(authDetail)?.[1] ?? ''
const scopes = [...scopeLine.matchAll(/'([^']+)'/g)].map((match) => match[1])
const hasScope = scopes.includes(REQUIRED_SCOPE)

const issueResult = auth.ok
    ? run('gh', ['issue', 'view', issueNumber, '--json', 'number,title,body,labels,state,url'])
    : { ok: false, out: '', err: '' }

const target = out ?? join(mkdtempSync(join(tmpdir(), 'pr-review-')), 'spec.md')

const header = [
    '# Spec',
    '',
    `issue:      #${issueNumber}`,
    `found via:  ${matchedOn}`,
    `branch:     ${branch || '(detached)'}`,
    `base:       ${base}`,
    ''
]

if (issueResult.ok) {
    const issue = JSON.parse(issueResult.out)
    const labels = (issue.labels ?? []).map((label) => label.name).join(', ') || '(none)'
    const body = [
        header.join('\n'),
        `## PBI #${issue.number}`,
        '',
        `**${issue.title}**`,
        '',
        `- state:  ${issue.state}`,
        `- labels: ${labels}`,
        `- url:    ${issue.url}`,
        '',
        '---',
        '',
        issue.body ?? '(empty body)',
        '',
        planSection,
        ''
    ].join('\n')
    emit(body, target, `Fetched PBI #${issueNumber}.\n`)
    process.exit(0)
}

// --- The number is known but unreachable: say precisely why ------------------

const guidance = []

if (!ghAvailable) {
    guidance.push(
        'The GitHub CLI (`gh`) is not installed or not on the PATH.',
        'Install it, or paste the PBI text into the chat.',
        '',
        'The review will proceed without the spec, and the verdict will say so.'
    )
} else if (!auth.ok) {
    guidance.push(
        'The GitHub CLI is not authenticated, so the PBI cannot be fetched.',
        '',
        'Run:',
        '',
        '```bash',
        'gh auth login',
        '```',
        '',
        `Then confirm the token carries the \`${REQUIRED_SCOPE}\` scope (needed for a`,
        'private repository):',
        '',
        '```bash',
        'gh auth status',
        '```',
        '',
        'The review will proceed without the spec, and the verdict will say so.'
    )
} else if (!hasScope) {
    guidance.push(
        `The GitHub CLI is authenticated but the token lacks the \`${REQUIRED_SCOPE}\` scope,`,
        'so a private repository issue cannot be read.',
        '',
        'Run:',
        '',
        '```bash',
        `gh auth refresh -h github.com -s ${REQUIRED_SCOPE}`,
        '```',
        '',
        'The review will proceed without the spec, and the verdict will say so.'
    )
} else {
    guidance.push(
        `Issue #${issueNumber} could not be read, though the CLI is authenticated.`,
        'It may not exist, or it may belong to another repository.',
        '',
        'The review will proceed without the spec, and the verdict will say so.'
    )
}

const blocked = [
    header.join('\n'),
    '## SPEC UNAVAILABLE — ACTION REQUIRED',
    '',
    `Issue #${issueNumber} was identified (${matchedOn}) but could not be fetched.`,
    '',
    ...guidance,
    '',
    planSection,
    ''
].join('\n')

/**
 * The banner goes to STDERR, not stdout. A non-zero exit with a message on
 * stderr is what surfaces as a failure the user actually reads; stdout is
 * reserved for the short status line so neither path can flood the chat.
 */
process.stderr.write(
    [
        '',
        ` SPEC UNAVAILABLE — issue #${issueNumber} was identified but not fetched.`,
        '',
        ...guidance,
        ''
    ].join('\n')
)

emit(blocked, target, `Spec unavailable — see the warning above.\n`)

process.exit(2)
