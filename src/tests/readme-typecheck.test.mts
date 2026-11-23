import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * The README's TypeScript examples are type-checked against the built
 * declarations.
 *
 * A documented example that does not compile is worse than no example: it
 * teaches a signature the library rejects. `readme-*-examples.test.mts` mirror
 * the snippets by hand, which cannot catch a drift introduced by editing the
 * README itself — the mirror simply keeps testing its own copy.
 *
 * Two rules make this robust without a hand-maintained list:
 *
 * - Only **complete** examples are checked: a fence that declares a class
 *   extending `Contracted` and contains no an elided-body placeholder. A fragment
 *   that elides its body cannot compile, and reporting that would train the
 *   reader to ignore this test.
 * - A fence that names a library export but does not import it gets the import
 *   synthesized. Most examples are written as a class body with the import
 *   stated once earlier in the prose.
 */
const projectRoot = resolve(import.meta.dirname, '..', '..'),
    tscPath = join(projectRoot, 'node_modules', 'typescript', 'lib', 'tsc.js'),
    readmePath = join(projectRoot, 'README.md'),
    // The long-form guide is documentation in the same sense as the README, so it is
    // held to the same rule: a documented example that does not compile teaches a
    // shape the library rejects. Listing the file rather than globbing keeps the
    // check explicit about what it covers.
    guidePaths = [join(projectRoot, 'docs', 'testing.md')];

const PACKAGE = '@final-hill/decorator-contracts';

/** Every name the package exports that an example might reference. */
const LIBRARY_NAMES = [
    'AssertionError', 'Contracted', 'checkedMode', 'encapsulationMode',
    'demands', 'ensures', 'invariant', 'rescue', 'iff', 'implies', 'assert',
    'getContractMetadata', 'getFeatureContracts',
    'DemandsSubject', 'EnsuresSubject', 'InvariantSubject', 'RescueSubject',
    'DemandsPredicate', 'EnsuresPredicate', 'InvariantPredicate', 'RescueHandler',
    'ArmOptions', 'ViolationFactory', 'ContractViolation',
    'StandardSchemaV1', 'ContractMetadata', 'FeatureContracts',
];

/** Names exported as types rather than values. */
const TYPE_NAMES = new Set([
    'DemandsSubject', 'EnsuresSubject', 'InvariantSubject', 'RescueSubject',
    'DemandsPredicate', 'EnsuresPredicate', 'InvariantPredicate', 'RescueHandler',
    'ArmOptions', 'ViolationFactory', 'ContractViolation',
    'StandardSchemaV1', 'ContractMetadata', 'FeatureContracts',
]);

interface Fence {
    line: number;
    body: string;
}

/** Every ```typescript fence in `markdownPath`, with the line its body starts on. */
const typescriptFences = (markdownPath: string = readmePath): Fence[] => {
    const lines = readFileSync(markdownPath, 'utf8').split('\n'),
        fences: Fence[] = [];

    let open = -1;

    for (const [index, line] of lines.entries()) {
        if (/^```typescript\s*$/.test(line)) open = index;
        else if (/^```\s*$/.test(line) && open >= 0) {
            fences.push({ line: open + 2, body: lines.slice(open + 1, index).join('\n') });
            open = -1;
        }
    }

    return fences;
};

/**
 * The fence source, with a synthesized import for any library name it uses but
 * does not import.
 *
 * `type` is prefixed for the interface names so the check does not depend on
 * `verbatimModuleSyntax`.
 */
const withImports = (body: string): string => {
    const alreadyImported = new Set(
        [...body.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}/g)]
            .flatMap(match => match[1].split(',').map(part => part.replace(/^\s*type\s+/, '').trim())),
    );

    const missing = LIBRARY_NAMES.filter(name =>
        !alreadyImported.has(name) && new RegExp(`\\b${name}\\b`).test(body));

    if (missing.length === 0) return body;

    const specifiers = missing.map(name => TYPE_NAMES.has(name) ? `type ${name}` : name);

    return `import { ${specifiers.join(', ')} } from '${PACKAGE}';\n\n${body}`;
};

/**
 * True when a fence is a complete example rather than an excerpt.
 *
 * A fence that elides its body (`// ...`) or that never declares a
 * `Contracted` subclass cannot compile, and the reason has nothing to do with
 * the documentation's accuracy. Requiring both keeps the test's failures
 * meaningful.
 */
const isCompleteExample = (body: string): boolean =>
    /class\s+\w+\s+extends\s+Contracted/.test(body)
    && !/\/\*\s*\.\.\.\s*\*\/|\/\/\s*\.\.\./.test(body);

/**
 * Library names a fence imports but never uses.
 *
 * Computed from the fence text rather than delegated to `noUnusedLocals`, and
 * applied to every fence including the excerpts. An import that the example no
 * longer needs is a defect of the same kind as one that does not compile: a
 * reader copies it, and it teaches a name the snippet has no use for. Restricting
 * the check to the library's own exports keeps it from firing on the illustrative
 * locals an excerpt declares (`const avg = ...`).
 *
 * A fence made only of an import statement is exempt: its subject is the import,
 * which is how the documentation says a type is available. There is nothing else
 * for it to use the name in.
 */
const unusedLibraryImports = (body: string): string[] => {
    const imported = [...body.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g)]
        .filter(match => match[2] === PACKAGE)
        .flatMap(match => match[1].split(',').map(part => part.replace(/^\s*type\s+/, '').trim()))
        .filter(Boolean);

    if (imported.length === 0) return [];

    // Strip whole import statements — `[^}]*` spans newlines, so a multi-line
    // specifier list is removed as one statement rather than leaving its tail
    // behind to be mistaken for a use.
    const withoutImports = body.replace(/^import\s+(?:type\s+)?\{[^}]*\}\s+from\s+'[^']*';?/gm, '')
        .replace(/^import\s+[^;{]*from\s+'[^']*';?/gm, '');

    if (withoutImports.trim() === '') return [];

    return imported.filter(name => !new RegExp(`\\b${name}\\b`).test(withoutImports));
};

describe('The README examples type-check', () => {
    test('no example imports a library name it does not use', () => {
        const failures = typescriptFences()
            .map(fence => ({ line: fence.line, unused: unusedLibraryImports(fence.body) }))
            .filter(finding => finding.unused.length > 0)
            .map(finding => `README line ${finding.line}: unused ${finding.unused.join(', ')}`);

        nodeAssert.deepStrictEqual(failures, [], 'an example must use what it imports');
    });

    test('every complete example compiles', () => {
        if (!existsSync(tscPath)) return;
        if (!existsSync(join(projectRoot, 'dist', 'index.d.mts'))) return;

        nodeAssert.deepStrictEqual(compileFailures(readmePath, 'README'), [], 'documented examples must compile');
    });

    test('every complete example in the testing guide compiles', () => {
        if (!existsSync(tscPath)) return;
        if (!existsSync(join(projectRoot, 'dist', 'index.d.mts'))) return;

        for (const guide of guidePaths)
            nodeAssert.deepStrictEqual(
                compileFailures(guide, 'docs/testing.md'),
                [],
                'a guide whose examples do not run teaches a shape the library rejects',
            );
    });
});

/**
 * Type-checks each complete fence in one markdown file and reports the real errors.
 *
 * A fence is checked only when it declares a `Contracted` subclass, references the
 * package, and elides nothing: a fragment that omits its body cannot compile, and
 * reporting that would train the reader to ignore this test. `label` names the file
 * in the failure message.
 */
function compileFailures(markdownPath: string, label: string): string[] {
    const dir = join(projectRoot, '.readme-typecheck');

    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });

    try {
        const failures: string[] = [];

        for (const [index, fence] of typescriptFences(markdownPath).entries()) {
            if (!isCompleteExample(fence.body)) continue;

            const source = withImports(fence.body);

            if (!new RegExp(`from '${PACKAGE}'`).test(source)) continue;

            const file = join(dir, `fence-${index}.mts`);

            writeFileSync(file, source);

            try {
                execFileSync(process.execPath, [
                    tscPath, '--noEmit', '--strict', '--target', 'ES2024',
                    '--module', 'NodeNext', '--moduleResolution', 'nodenext',
                    '--ignoreConfig', '--types', 'node', file,
                ], { cwd: projectRoot, encoding: 'utf8', stdio: 'pipe' });
            } catch (error: any) {
                const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;

                // Missing context is the one error a complete-looking
                // example may still produce legitimately: a helper the
                // prose defines. A type error is a claim about the API.
                const real = output
                    .split('\n')
                    .filter((line: string) => line.includes('error TS')
                        && !line.includes('TS2304')
                        && !line.includes('TS2307'));

                if (real.length > 0)
                    failures.push(`${label} line ${fence.line}:\n${real.slice(0, 4).join('\n')}`);
            }
        }

        return failures;
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
}
