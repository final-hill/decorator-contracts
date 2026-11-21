#!/usr/bin/env node
/**
 * Verify that the two structural probes in check-structure.mjs actually fire.
 *
 * ## Why this exists
 *
 * A detector that has never been seen to fail is not evidence. During the
 * construction of `check-structure.mjs` three of its checks were broken and
 * every one of them passed silently:
 *
 * - the adjacent-docblock comparison compared a CLOSING line's indent with the
 *   next block's OPENING indent, which can never match;
 * - the walk-back to a block's opener started ON the closer and bailed on its
 *   first iteration;
 * - a "drifted docblock" heuristic produced 168 false positives on this tree.
 *
 * All three were found by hand. Nothing stopped them from shipping, and nothing
 * would have stopped a later edit from re-breaking them. This script is that
 * stop: it feeds the probe a fixture whose defects are KNOWN, and asserts the
 * probe finds exactly them.
 *
 * ## The shape of a check
 *
 * Each case builds a fixture, runs the probe over it with `--baseline NO_REF`
 * (so nothing is suppressed), and compares the reported findings against the
 * expected set. A case fails when the probe reports nothing, reports the wrong
 * KIND, or reports a finding for a construct that is legitimate.
 *
 * Usage:
 *   node .github/skills/pr-review/scripts/verify-structure-probe.mjs
 *
 * Exit code: 0 all checks pass, 1 a check regressed.
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const PROBE = new URL('./check-structure.mjs', import.meta.url).pathname

/** Run the probe over one fixture file and parse its findings. */
function runProbe(file) {
    let output
    try {
        output = execFileSync(process.execPath, [PROBE, file, '--baseline', 'NO_SUCH_REF'], {
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe']
        })
    } catch (error) {
        // Exit 1 is expected when findings exist; the stdout is still the report.
        output = error.stdout ?? ''
    }
    const docblocks = [...output.matchAll(/DOCBLOCK (ADJACENT|ORPHANED)/g)].map((m) => m[1])
    const complexity = [...output.matchAll(/own=\s*(\d+) total=\s*(\d+)\s+(\S+)/g)].map((m) => ({
        own: Number(m[1]),
        total: Number(m[2]),
        name: m[3]
    }))
    return { docblocks, complexity }
}

const cases = []
const check = (name, fn) => cases.push({ name, fn })

/* ------------------------------------------------------------------ */
/* docblock detection                                                  */
/* ------------------------------------------------------------------ */

check('ADJACENT fires when two docblocks share an indent', ({ file }) => {
    writeFileSync(file, [
        'export class Fixture {',
        '    /**',
        '     * First block, which documents nothing.',
        '     */',
        '    /**',
        '     * Real docs for the method below.',
        '     */',
        '    method(): void {}',
        '}'
    ].join('\n'))
    const { docblocks } = runProbe(file)
    if (!docblocks.includes('ADJACENT')) throw new Error(`expected ADJACENT, got [${docblocks}]`)
})

check('ADJACENT does NOT fire when the two blocks are at different indents', ({ file }) => {
    // A nested member legitimately carries its own docblock one level deeper.
    writeFileSync(file, [
        'export interface Fixture {',
        '    /** Outer member. */',
        '    outer: {',
        '        /** Inner member. */',
        '        inner: string',
        '    }',
        '}'
    ].join('\n'))
    const { docblocks } = runProbe(file)
    if (docblocks.includes('ADJACENT')) throw new Error('reported ADJACENT for legitimately nested docblocks')
})

check('ORPHANED fires when a docblock sits above a closing brace', ({ file }) => {
    writeFileSync(file, [
        'export class Fixture {',
        '    method(): void {}',
        '    /**',
        '     * Documents nothing: the next line closes the class.',
        '     */',
        '}'
    ].join('\n'))
    const { docblocks } = runProbe(file)
    if (!docblocks.includes('ORPHANED')) throw new Error(`expected ORPHANED, got [${docblocks}]`)
})

check('ORPHANED fires when a docblock ends the file', ({ file }) => {
    writeFileSync(file, [
        'export const value = 1',
        '',
        '/**',
        ' * Documents nothing: nothing follows.',
        ' */'
    ].join('\n'))
    const { docblocks } = runProbe(file)
    if (!docblocks.includes('ORPHANED')) throw new Error(`expected ORPHANED, got [${docblocks}]`)
})

check('a properly documented file reports NO docblock findings', ({ file }) => {
    writeFileSync(file, [
        '/**',
        ' * A module docblock.',
        ' */',
        'export class Fixture {',
        '    /**',
        '     * Documents the method.',
        '     */',
        '    method(): void {}',
        '}'
    ].join('\n'))
    const { docblocks } = runProbe(file)
    if (docblocks.length > 0) throw new Error(`false positive: [${docblocks}]`)
})

/* ------------------------------------------------------------------ */
/* complexity measurement                                              */
/* ------------------------------------------------------------------ */

check('own-complexity counts a branchy function above the gate', ({ file }) => {
    const branches = Array.from({ length: 12 }, (_, i) => `        if (x === ${i}) return ${i}`).join('\n')
    writeFileSync(file, `export function branchy(x: number): number {\n${branches}\n        return -1\n}`)
    const { complexity } = runProbe(file)
    const row = complexity.find((r) => r.name.includes('branchy'))
    if (!row) throw new Error('a 12-branch function was not reported')
    if (row.own < 12) throw new Error(`own=${row.own}, expected >= 12`)
})

check('total-complexity catches branches hidden in nested closures', ({ file }) => {
    // own is low; the work is in callbacks. This is the shape the lint rule misses.
    writeFileSync(file, [
        'export function orchestrator(items: number[]): number[] {',
        '    return items',
        '        .filter((item) => {',
        '            if (item < 0) return false',
        '            if (item > 100) return false',
        '            if (item % 2 === 0) return false',
        '            return true',
        '        })',
        '        .map((item) => {',
        '            if (item === 1) return 1',
        '            if (item === 3) return 3',
        '            if (item === 5) return 5',
        '            return item',
        '        })',
        '}'
    ].join('\n'))
    const { complexity } = runProbe(file)
    const row = complexity.find((r) => r.name.includes('orchestrator'))
    if (!row) throw new Error('an orchestrator whose work is in callbacks was not reported')
    if (row.total - row.own < 3) throw new Error(`hidden delta too small: own=${row.own} total=${row.total}`)
})

check('a declarative data table is NOT reported (the own-floor)', ({ file }) => {
    // own = 1, total high: branches are data, one per row. Nothing to decompose.
    const rows = Array.from({ length: 10 }, (_, i) => [
        '        {',
        `            category: 'c${i}',`,
        `            getChecks: (t: string) => t === 'x' ? [] : [{ name: 'c${i}' }]`,
        '        }'
    ].join('\n')).join(',\n')
    writeFileSync(file, `export function registry() {\n    return [\n${rows}\n    ]\n}`)
    const { complexity } = runProbe(file)
    if (complexity.some((r) => r.name.includes('registry')))
        throw new Error('a declarative data table was reported as a complexity hotspot')
})

check('a simple function is not reported at all', ({ file }) => {
    writeFileSync(file, 'export function trivial(x: number): number {\n    return x + 1\n}')
    const { complexity } = runProbe(file)
    if (complexity.length > 0) throw new Error(`false positive: ${JSON.stringify(complexity)}`)
})

/* ------------------------------------------------------------------ */
/* runner                                                              */
/* ------------------------------------------------------------------ */

const dir = mkdtempSync(join(tmpdir(), 'probe-verify-'))
let failures = 0

for (const c of cases) {
    const file = join(dir, 'fixture.ts')
    try {
        c.fn({ file })
        console.log(`  PASS  ${c.name}`)
    } catch (error) {
        failures++
        console.log(`  FAIL  ${c.name}\n        ${error.message}`)
    }
}

rmSync(dir, { recursive: true, force: true })

console.log('')
console.log(failures === 0
    ? `verify-structure-probe: ${cases.length} checks pass`
    : `verify-structure-probe: ${failures} of ${cases.length} checks FAILED`)

process.exit(failures === 0 ? 0 : 1)
