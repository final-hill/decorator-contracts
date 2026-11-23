#!/usr/bin/env node
/**
 * Check whether a test can FAIL, by breaking the implementation on purpose.
 *
 * This is the mechanical form of Pass C′. A green test proves nothing until
 * something makes it red; "I believe this assertion is load-bearing" is an
 * opinion, and "removing the cancellation makes it fail" is a fact. So the
 * reviewer states one edit that must break the criterion, applies it, runs the
 * named test, and reads the result.
 *
 * Exit codes are the contract, mirroring fetch-spec.mjs:
 *   0  the mutation was CAUGHT — the suite goes red without the code.
 *   1  the mutation SURVIVED — the suite is green either way. The criterion is
 *      UNMET, and the review must report it as such.
 *   2  the check could not run — the suite is ALREADY red, the find string is
 *      absent or ambiguous, or the mutated suite never executed. Fix the
 *      invocation; the result says nothing about the assertion.
 *
 * **A BASELINE RUN COMES FIRST.** If the suite is already failing, a red
 * result after the mutation cannot be attributed to the mutation, so the check
 * refuses rather than laundering an existing failure into a "CAUGHT". Pass
 * `--skip-baseline` only when the runtime cost matters more than the confidence.
 *
 * **A SUITE THAT NEVER RAN IS NOT A CAUGHT MUTATION.** A syntax error in the
 * mutation, a broken import, or a missing file exits non-zero without telling us
 * anything about the assertion. The runner's output is inspected for zero
 * executed tests, and that case exits 2.
 *
 * The worktree is ALWAYS restored — on failure, on a signal, and on a normal
 * exit. The mutation is written to the real file because the runner resolves the
 * module from disk; the original bytes are held in a temp file and put back in a
 * `finally`.
 *
 * **THE BUILD RUNS BETWEEN THE EDIT AND THE SUITE.** The tests import this
 * library by its package name, and the `exports` map resolves that to `dist/`.
 * The mutation is written to `src/`, so without a rebuild the suite loads the
 * previous bundle and every mutation reports SURVIVED. The build is part of the
 * measurement, not a convenience.
 *
 * Usage:
 *   node .github/skills/review-pr/scripts/mutate.mjs \
 *     --file src/admissibility.mts \
 *     --test src/tests/standard-schema.test.mts \
 *     --find "    if (!options?.normalize || isSchema(arm)) return;" \
 *     --replace "    return;" \
 *     --name "predicate normalization is refused"
 *
 *   # Validate the find string without touching anything or running tests
 *   node .../mutate.mjs --file ... --find ... --replace ... --dry-run
 */
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

const argv = process.argv.slice(2)

/**
 * Read a flag's value.
 *
 * @param flag - The flag name, including its dashes
 * @returns The following argument, or null when the flag is absent
 */
const readFlag = (flag) => {
    const index = argv.indexOf(flag)
    return index === -1 ? null : argv[index + 1]
}

const file = readFlag('--file'),
    test = readFlag('--test'),
    find = readFlag('--find'),
    replace = readFlag('--replace'),
    name = readFlag('--name') ?? 'the mutation',
    dryRun = argv.includes('--dry-run'),
    skipBaseline = argv.includes('--skip-baseline')

class CannotRun extends Error { }

/**
 * Abandon the check with exit code 2 — "this result proves nothing".
 *
 * **IT THROWS RATHER THAN EXITING.** `process.exit()` inside a `try` does not
 * run the matching `finally`, so an exit on a failure path taken AFTER the
 * mutation is applied would leave the tree dirty. Every exit is funnelled
 * through `main`'s catch, which restores first.
 *
 * @param message - What went wrong, and what the caller should do
 */
function cannotRun(message) {
    throw new CannotRun(message)
}

/**
 * Runs the build, so the mutated source is what the tests actually load.
 *
 * The suite imports the library by its package name, which the `exports` map
 * resolves to `dist/`. A mutation written to `src/` is therefore invisible until
 * webpack regenerates the bundle: the tests would pass against the unmutated
 * build and every mutation would report SURVIVED. `webpack` is invoked directly
 * rather than through `npm run build`, whose `prebuild` hook lints first and
 * would reject a mutation for being unused instead of testing it.
 *
 * @throws {CannotRun} When the build fails, because a suite run after a broken
 *   build tests the previous bundle
 */
function build() {
    try {
        execFileSync('npx', ['webpack'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        })
    } catch (error) {
        cannotRun(`the build failed, so the suite would test the previous bundle:\n${String(error.stdout ?? '').slice(0, 800)}`)
    }
}

/**
 * Run the named suite and report how it went.
 *
 * @param props.suite - The test file to run
 * @returns The captured output, and how many tests ran and failed
 */
function runSuite({ suite }) {
    let output = ''

    build()

    try {
        output = execFileSync(process.execPath, ['--import', 'tsx', '--test', suite], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        })
    } catch (error) {
        // `node --test` writes the failure report to stdout; stderr carries
        // loader noise, so both are kept and the summary is read from the whole.
        output = `${error.stdout ?? ''}\n${error.stderr ?? ''}`
    }

    // **THE `ℹ` SUMMARY LINES, NOT THE FIRST COUNT.** `node --test` reports
    // `ℹ tests 13` / `ℹ pass 13` / `ℹ fail 0` as separate lines, and prints the
    // names of failing tests above them. Reading a bare `/(\d+) fail/` can pick
    // up an assertion message, so the counts are read from the labelled lines.
    const count = (label) => {
        const match = output.match(new RegExp(`^\\u2139\\s+${label}\\s+(\\d+)`, 'm'))
        return match ? Number(match[1]) : null
    }

    const failed = count('fail') ?? 0,
        passed = count('pass') ?? 0,
        total = count('tests'),
        // **ZERO EXECUTED TESTS IS THE "NEVER RAN" SIGNAL.** A syntax error or a
        // failed import prints a stack trace and no summary at all, which must
        // never be read as the assertion doing its job.
        neverRan = total === null || total === 0

    return { output, failed, passed, total, neverRan }
}

/**
 * Print the result and the verdict.
 *
 * @param props.caught - Whether the mutation made the suite fail
 * @param props.run - The mutated run's counts
 */
function report(props) {
    console.log(`${props.caught ? '✓ CAUGHT' : '✗ SURVIVED'} — ${name}`)
    console.log(`  file:  ${file}`)
    console.log(`  test:  ${test}`)
    console.log(`  run:   ${props.run.failed} failed | ${props.run.passed} passed`)
    console.log(props.caught
        ? '  verdict: the assertion fails without the code, so it is load-bearing.'
        : '  verdict: the suite is green either way, so this criterion is UNMET. Report it.')
}

if (!file || !find || (replace === null && !dryRun))
    cannotRun('usage: --file <source> --test <spec> --find <literal> --replace <literal> [--name <label>] [--dry-run] [--skip-baseline]')

if (!dryRun && !test)
    cannotRun('--test is required (it is the suite that should catch the mutation)')

/**
 * The check, end to end. Every exit code leaves through here, AFTER the
 * restore, so no failure path can leave the mutation applied.
 *
 * @returns The process exit code
 */
function main() {
    let original

    try {
        original = readFileSync(file, 'utf8')
    } catch {
        cannotRun(`${file} could not be read — check the path`)
    }

    // **AN AMBIGUOUS FIND IS A SILENT WRONG MUTATION.** The edit must name
    // exactly one site; a string that occurs twice would mutate the first
    // occurrence only, and the reviewer would draw a conclusion about code they
    // never touched.
    const occurrences = original.split(find).length - 1

    if (occurrences === 0)
        cannotRun(`the --find literal does not occur in ${file} — re-read the file and copy the text exactly`)

    if (occurrences > 1)
        cannotRun(`the --find literal occurs ${occurrences} times in ${file} — include more surrounding text so exactly one site is named`)

    if (dryRun) {
        console.log(`✓ ${name}: the find literal occurs once in ${file} (nothing was changed)`)
        return 0
    }

    if (!skipBaseline) {
        const baseline = runSuite({ suite: test })

        if (baseline.neverRan)
            cannotRun(`the named suite does not execute:\n${baseline.output.slice(0, 800)}`)

        if (baseline.failed > 0)
            cannotRun(`the named suite is ALREADY red (${baseline.failed} failed), so a mutation result cannot be attributed to the mutation`)

        if (baseline.passed === 0)
            cannotRun('the named suite ran no tests, so it cannot prove anything')
    }

    const workDir = mkdtempSync(join(tmpdir(), 'pr-review-mutation-')),
        backup = join(workDir, basename(file))

    /** Put the original bytes back. Safe to call twice. */
    function restore() {
        try {
            copyFileSync(backup, file)
        } catch (error) {
            // **A FAILED RESTORE IS THE ONE UNRECOVERABLE OUTCOME**, so it is
            // reported as its own loud failure rather than swallowed.
            console.error(`✗ RESTORE FAILED for ${file} — the tree is dirty. The original is at ${backup}`)
            console.error(String(error))
        }
    }

    copyFileSync(file, backup)

    // An interrupt must not leave the mutation applied.
    for (const signal of ['SIGINT', 'SIGTERM'])
        process.once(signal, () => {
            restore()
            process.exit(2)
        })

    try {
        writeFileSync(file, original.replace(find, replace))
        const mutated = runSuite({ suite: test })

        if (mutated.neverRan)
            cannotRun(`the suite could not run with the mutation applied:\n${mutated.output.slice(0, 800)}`)

        // **THE TEST MUST FAIL, NOT THE RUNNER.** A non-zero exit with zero
        // failures is a runner-level fault, so the failure COUNT decides, not
        // the exit code.
        const caught = mutated.failed > 0

        report({ caught, run: mutated })
        return caught ? 0 : 1
    } finally {
        restore()
        rmSync(workDir, { recursive: true, force: true })
    }
}

try {
    process.exitCode = main()
} catch (error) {
    if (!(error instanceof CannotRun))
        throw error

    console.error(`✗ cannot run: ${error.message}`)
    process.exitCode = 2
}

