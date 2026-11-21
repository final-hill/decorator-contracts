#!/usr/bin/env node
/**
 * Structural probes the linter cannot see.
 *
 * Two classes of defect pass typecheck, lint, and the whole test suite while
 * being genuinely wrong. Both were found by hand during a large refactor,
 * several times each, which is why this exists as a script rather than advice.
 *
 * ## 1. Cyclomatic complexity the lint rule cannot count
 *
 * The repo enforces `complexity: max 10`, and it reports a single number:
 * branches in the function body, NOT descending into nested functions. That
 * number is honest about a `switch`, and blind to a 130-line orchestrator whose
 * work happens inside anonymous callbacks. A function can score 6 and be the
 * least readable thing in the file.
 *
 * So every function is reported TWICE:
 *   - `own`   -- branches excluding nested functions. This is the gate's number.
 *   - `total` -- branches including nested closures.
 * `total` far above `own` is the shape the gate misses: the difficulty is in
 * the callbacks the author cannot see from the signature.
 *
 * ## 2. Adjacent and orphaned docblocks
 *
 * A scripted move (extract method, move a block, append a module) can leave one
 * docblock stacked on another, or a docblock stranded above a closing brace. The
 * result compiles, lints, typechecks, and passes every test -- the comment simply
 * now describes the wrong thing, or nothing. No other tool reports it.
 *
 * Both shapes are reported:
 *   - ADJACENT -- a closing `*` + `/` whose next non-blank line opens a new doc.
 *   - ORPHANED -- a docblock whose next non-blank line closes a block or ends the
 *     file, so it documents nothing.
 *
 * A docblock deliberately followed by another docblock is legal for an INTERFACE
 * MEMBER or a variable that carries its own annotation, so a nested block is
 * reported only when it is a real duplicate: the two are checked at the same
 * indentation, which is what a scripted paste produces.
 *
 * ## Baseline mode
 *
 * A pre-existing wart is not this change's defect. `--baseline <ref>` compares
 * against the same file at `<ref>` (default `HEAD`) and reports only findings that
 * are NEW, so a reviewer is never asked to fix history.
 *
 * ## Self-exclusion
 *
 * This script, and the other skill scripts, are excluded: a tool is not subject
 * to the standard it applies to the product.
 *
 * Usage:
 *   node .github/skills/pr-review/scripts/check-structure.mjs --changed
 *   node .github/skills/pr-review/scripts/check-structure.mjs server/application
 *   node .github/skills/pr-review/scripts/check-structure.mjs --baseline origin/master
 *
 * Exit code: 0 clean, 1 findings survive the baseline, so it can gate a review.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

const SOURCE_EXTENSIONS = ['.ts', '.mts', '.cts', '.vue']
const SKIP_DIRECTORIES = new Set(['node_modules', '.nuxt', '.output', '.git', 'dist', 'coverage', 'vendor'])

/**
 * This repository is a library, so the test tree sits inside `src/` rather than
 * beside it. A test fixture is not product code: its functions are shaped for a
 * single scenario and its docblocks are labels, so reporting them buries the
 * rows that matter.
 */
function isTestPath(path) {
    return /(?:^|\/)tests?\//.test(path) || /\.test\.[mc]?ts$/.test(path)
}

/** The gate's ceiling, reported for context rather than enforced here. */
const GATE_COMPLEXITY = 10
/** Report a function when its OWN branching reaches this. */
const REPORT_THRESHOLD = 8
/** How many branches must live in CALLBACK closures before it is worth a report. */
const HIDDEN_BRANCH_DELTA = 3

function parseArgs(argv) {
    const out = { paths: [], changedOnly: false, baseline: 'HEAD', help: false }
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i]
        if (arg === '--changed') out.changedOnly = true
        else if (arg === '--baseline') out.baseline = argv[++i]
        else if (arg === '--help' || arg === '-h') out.help = true
        else if (!arg.startsWith('-')) out.paths.push(arg)
    }
    return out
}

/** Run git, swallowing the "path exists on disk but not in REF" case. */
function git(args, tolerateFailure = false) {
    try {
        return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (error) {
        if (tolerateFailure) return null
        throw error
    }
}

function changedFiles() {
    const tracked = (git(['diff', '--name-only', 'HEAD', '--'], true) ?? '').split('\n')
    const untracked = (git(['ls-files', '--others', '--exclude-standard'], true) ?? '').split('\n')
    return [...new Set([...tracked, ...untracked])].filter(Boolean)
}

/** This skill's own scripts are tools, not product code. */
function isToolingPath(path) {
    return path.startsWith('.github/')
}

function walk(target, acc) {
    if (!existsSync(target)) return acc
    const stats = statSync(target)
    if (stats.isFile()) {
        if (isSourceFile(target)) acc.push(target)
        return acc
    }
    for (const entry of readdirSync(target, { withFileTypes: true })) {
        if (entry.isDirectory() && SKIP_DIRECTORIES.has(entry.name)) continue
        walk(join(target, entry.name), acc)
    }
    return acc
}

function isSourceFile(path) {
    return SOURCE_EXTENSIONS.some((ext) => path.endsWith(ext))
        && !isToolingPath(path)
        && !isTestPath(path)
}

/* ------------------------------------------------------------------ */
/* complexity                                                          */
/* ------------------------------------------------------------------ */

function isFunctionLike(node) {
    return ts.isFunctionDeclaration(node)
        || ts.isArrowFunction(node)
        || ts.isFunctionExpression(node)
        || ts.isMethodDeclaration(node)
        || ts.isConstructorDeclaration(node)
        || ts.isGetAccessorDeclaration(node)
        || ts.isSetAccessorDeclaration(node)
}

/** The branch a node contributes, using the decision points the lint rule counts. */
function branchOf(node) {
    switch (node.kind) {
        case ts.SyntaxKind.IfStatement:
        case ts.SyntaxKind.ConditionalExpression:
        case ts.SyntaxKind.CaseClause:
        case ts.SyntaxKind.DefaultClause:
        case ts.SyntaxKind.ForStatement:
        case ts.SyntaxKind.ForInStatement:
        case ts.SyntaxKind.ForOfStatement:
        case ts.SyntaxKind.WhileStatement:
        case ts.SyntaxKind.DoStatement:
        case ts.SyntaxKind.CatchClause:
            return 1
        case ts.SyntaxKind.BinaryExpression: {
            const op = node.operatorToken.kind
            return op === ts.SyntaxKind.AmpersandAmpersandToken
                || op === ts.SyntaxKind.BarBarToken
                || op === ts.SyntaxKind.QuestionQuestionToken ? 1 : 0
        }
        default:
            return 0
    }
}

/**
 * Is this closure a LOGIC callback (an argument) rather than DATA (a property)?
 *
 * `items.filter(cb)`    -> argument: the callback runs on every element.
 * `[{ getChecks: cb }]` -> property: the function is a value in a returned row,
 *                          which a reader scans rather than follows.
 */
function isLogicCallback(node) {
    const parent = node.parent
    if (!parent) return false
    return ts.isCallExpression(parent) && parent.arguments.some((arg) => arg === node)
}

/**
 * Measure one function three ways:
 * - `own`      branches in the body, not descending into nested functions
 *              (exactly what the lint rule counts);
 * - `total`    branches including every nested closure;
 * - `callbackBranches`
 *              branches inside closures that are passed as CALL ARGUMENTS --
 *              the logic hidden in `filter`/`map`/`reduce` callbacks. Branches
 *              inside function-valued object PROPERTIES are excluded, because
 *              those are data rows rather than logic.
 */
function measure(fn) {
    if (!fn.body) return { own: 1, total: 1, callbackBranches: 0 }

    let own = 1
    const walkOwn = (node, depth) => {
        if (depth > 0 && isFunctionLike(node)) return
        own += branchOf(node)
        ts.forEachChild(node, (child) => walkOwn(child, depth + 1))
    }
    walkOwn(fn.body, 0)

    let total = 1
    const walkAll = (node) => {
        total += branchOf(node)
        ts.forEachChild(node, walkAll)
    }
    walkAll(fn.body)

    // Callbacks: enter every nested function, but only tally the ones reached
    // through a call argument.
    let callbackBranches = 0
    const walkCallbacks = (node, insideCallback) => {
        let tally = insideCallback
        if (isFunctionLike(node) && node !== fn) {
            // Only a callback in ARGUMENT position counts.
            tally = insideCallback || isLogicCallback(node)
        }
        if (tally) callbackBranches += branchOf(node)
        ts.forEachChild(node, (child) => walkCallbacks(child, tally))
    }
    walkCallbacks(fn.body, false)

    return { own, total, callbackBranches }
}

function collectFunctions(sourceFile) {
    const rows = []
    const lineOf = (node) => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

    const visit = (node, owner) => {
        if (ts.isFunctionDeclaration(node) && node.name) {
            rows.push({ name: node.name.getText(sourceFile), scope: '', line: lineOf(node), ...measure(node) })
        } else if (ts.isMethodDeclaration(node)) {
            rows.push({
                name: node.name ? node.name.getText(sourceFile) : '<anonymous>',
                scope: owner,
                line: lineOf(node),
                ...measure(node)
            })
        } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer
            && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))) {
            rows.push({ name: node.name.getText(sourceFile), scope: owner, line: lineOf(node), ...measure(node.initializer) })
        }
        const nextOwner = ts.isClassDeclaration(node) && node.name ? node.name.getText(sourceFile) : owner
        ts.forEachChild(node, (child) => visit(child, nextOwner))
    }
    visit(sourceFile, '')
    return rows
}

/**
 * Whether a measured function deserves a report line.
 *
 * Two independent reasons, and conflating them is how a probe loses its audience:
 *
 * 1. **`own` at or above the threshold** -- the function itself branches a lot,
 *    which is the case the lint rule is already close to catching.
 * 2. **branches hidden in CALLBACK closures** -- the function reads as a short
 *    pipeline, but the difficulty is inside the callbacks it hands to
 *    `filter`/`map`/`reduce`/`sort`/`find`.
 *
 * Rule 2 needs a discriminator, because not every closure-heavy body is a
 * hotspot. A **declarative data table** -- a factory returning an array of
 * objects whose members each carry a ternary -- has exactly the same hidden
 * count and nothing to decompose: those branches are DATA, one per row.
 *
 * The discriminator is where the closures SIT, not how many branches they hold.
 * A callback passed as an ARGUMENT runs on every element and is logic the reader
 * must follow; a function-valued PROPERTY of a returned object literal is a value
 * the reader can scan. `measure` reports both counts.
 */
function isWorthReporting(fn) {
    if (fn.own >= REPORT_THRESHOLD) return true
    return fn.callbackBranches >= HIDDEN_BRANCH_DELTA
}

/* ------------------------------------------------------------------ */
/* docblocks                                                           */
/* ------------------------------------------------------------------ */

/**
 * Classify docblock problems. Textual by design: the shapes are a formatting
 * accident, and the text is exactly where they show.
 */
function docblockFindings(lines) {
    const findings = []
    const isBlank = (line) => line.trim() === ''

    const nextMeaningful = (from) => {
        for (let i = from; i < lines.length; i++) if (!isBlank(lines[i])) return i
        return -1
    }
    const indentOf = (line) => line.length - line.trimStart().length
    /**
     * Walk back from a closing `*` + `/` to ITS OWN opening `/**`, for the
     * indent. Starts one line above the closer, because the closer itself reads
     * as `*` + `/` and would end the walk immediately.
     */
    const openingIndentOf = (closingLine) => {
        for (let i = closingLine - 1; i >= 0; i--) {
            const text = lines[i].trim()
            if (text.startsWith('/**')) return indentOf(lines[i])
            // A previous block's closer means we walked past this block's opener.
            if (text === '*/') return null
        }
        return null
    }

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== '*/') continue

        const next = nextMeaningful(i + 1)
        if (next === -1) {
            findings.push({ line: i + 1, kind: 'ORPHANED', detail: 'docblock ends the file with no declaration after it' })
            continue
        }

        const nextText = lines[next].trim()
        if (['}', '};', ');', '];', ')'].includes(nextText)) {
            findings.push({ line: i + 1, kind: 'ORPHANED', detail: `docblock documents nothing (next line ${next + 1} is \`${nextText}\`)` })
            continue
        }

        if (nextText.startsWith('/**')) {
            // Two docblocks in a row. A member inside an object literal or an
            // interface is legitimate, so require the two to OPEN at the same
            // indentation -- which a scripted paste produces and which
            // hand-written nesting does not. (Comparing the closing line would
            // never match: a normal `*` + `/` sits one space right of its `/**`.)
            const openingIndent = openingIndentOf(i)
            if (openingIndent !== null && openingIndent === indentOf(lines[next])) {
                findings.push({
                    line: i + 1,
                    kind: 'ADJACENT',
                    detail: `docblock is immediately followed by another docblock at line ${next + 1} (same indentation: one of them documents nothing)`
                })
            }
        }
    }
    return findings
}

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

function analyse(text, file) {
    const sourceFile = ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TS)
    return { functions: collectFunctions(sourceFile), docblocks: docblockFindings(text.split('\n')) }
}

function main() {
    const args = parseArgs(process.argv.slice(2))
    if (args.help) {
        const header = readFileSync(new URL(import.meta.url), 'utf8')
        console.log(header.slice(header.indexOf('/**') + 3, header.indexOf('*/')))
        return 0
    }

    let files
    if (args.paths.length > 0) {
        files = [...new Set(args.paths.flatMap((p) => walk(p, [])))]
    } else if (args.changedOnly) {
        files = changedFiles().filter((f) => existsSync(f) && isSourceFile(f))
    } else {
        files = walk('src', [])
    }

    if (files.length === 0) {
        console.log('check-structure: no source files to inspect')
        return 0
    }

    let docblockCount = 0
    const complexityRows = []

    for (const file of files) {
        const text = readFileSync(file, 'utf8')
        const { functions, docblocks } = analyse(text, file)

        const baselineText = args.baseline ? git(['show', `${args.baseline}:${file}`], true) : null
        const baseline = baselineText === null ? { functions: [], docblocks: [] } : analyse(baselineText, file)

        // A pre-existing defect is not this change's. Compare by KIND (a moved
        // wart is still the same wart) rather than by line number, so a shifted
        // block does not read as new.
        for (const d of docblocks) {
            const alreadyPresent = baseline.docblocks.some((b) => b.kind === d.kind)
            if (alreadyPresent) continue
            docblockCount++
            console.log(`${file}:${d.line}  DOCBLOCK ${d.kind}  ${d.detail}`)
        }

        const baselineSignatures = new Set(baseline.functions.map((f) => `${f.name}:${f.own}:${f.total}`))
        for (const f of functions) {
            if (!isWorthReporting(f)) continue
            if (baselineSignatures.has(`${f.name}:${f.own}:${f.total}`)) continue
            complexityRows.push({ file, ...f })
        }
    }

    if (complexityRows.length > 0) {
        complexityRows.sort((a, b) => b.total - a.total || b.own - a.own)
        console.log('')
        console.log(`Complexity (gate ${GATE_COMPLEXITY}; own = what the rule counts, total = including nested closures)`)
        for (const r of complexityRows) {
            const qualified = r.scope ? `${r.scope}.${r.name}` : r.name
            const flag = r.total - r.own >= 3
                ? `  <-- ${r.total - r.own} branches hidden in nested closures`
                : (r.own > GATE_COMPLEXITY ? '  <-- OVER GATE' : '')
            console.log(`  ${relative('.', r.file)}:${r.line}  own=${String(r.own).padStart(2)} total=${String(r.total).padStart(2)}  ${qualified}${flag}`)
        }
    }

    const total = docblockCount + complexityRows.length
    console.log('')
    console.log(total === 0
        ? `check-structure: clean (${files.length} files, baseline ${args.baseline})`
        : `check-structure: ${docblockCount} docblock finding(s), ${complexityRows.length} complexity row(s) across ${files.length} files (baseline ${args.baseline})`)

    return total === 0 ? 0 : 1
}

process.exit(main())
