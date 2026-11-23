import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * https://github.com/final-hill/decorator-contracts/issues/291
 *
 * `exports.types` pointed at `./dist/index.d.ts`, but the build emits
 * `index.d.mts`. Modern resolutions recover by falling back, so this only
 * failed for `moduleResolution: "node"` — where the whole module came back as
 * `any`, silently disabling type checking for every consumer.
 *
 * This installs the package's `package.json` and `dist/` into a temporary
 * consumer and type-checks it, so the declared entry points are exercised as
 * published.
 *
 * It shells out only to `node`, running the local `tsc`, deliberately: `npm`
 * and `npx` are `.cmd` shims on Windows and cannot be spawned without a shell.
 */

const projectRoot = resolve(import.meta.dirname, '..', '..'),
    tscPath = join(projectRoot, 'node_modules', 'typescript', 'lib', 'tsc.js');

const readProjectPackage = (): any =>
    JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

/**
 * A consumer that only type-checks correctly if the real declarations load.
 * The first error requires the published predicate types; the second fails for
 * any package that resolves to `any`.
 */
const consumerSource = `
import { Contracted, demands } from '@final-hill/decorator-contracts';

class Foo extends Contracted {
    method(): void { }
}

// must be a compile error: the second parameter is the argument list
demands((_self: Foo, x: number) => x >= 0);

// must be a compile error: proves the declarations are not \`any\`
const wrong: number = 'not a number';
`;

interface TscResult {
    ok: boolean;
    output: string;
}

/**
 * Runs the local `tsc` against the consumer in `dir`.
 *
 * `execFileSync(process.execPath, [tscPath])` rather than `npx tsc`, so the
 * test works on Windows and needs no package manager.
 *
 * `moduleResolution: "node"` is `node10`, deprecated in TypeScript 6, where it
 * is an error rather than a warning. `ignoreDeprecations` keeps it compiling so
 * the legacy resolution path stays covered.
 */
const runTsc = (dir: string, moduleResolution: string, module: string): TscResult => {
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
            target: 'ES2024',
            module,
            moduleResolution,
            strict: true,
            noEmit: true,
            skipLibCheck: false,
            ignoreDeprecations: '6.0',
        },
        include: ['main.mts'],
    }));

    try {
        execFileSync(process.execPath, [tscPath, '-p', 'tsconfig.json'], { cwd: dir, encoding: 'utf8', stdio: 'pipe' });
        return { ok: true, output: '' };
    } catch (error: any) {
        return { ok: false, output: `${error.stdout ?? ''}${error.stderr ?? ''}` };
    }
}

describe('The published package resolves its type declarations', () => {
    const pkg = readProjectPackage();

    test('`exports.types` points at a file the build produces', () => {
        nodeAssert.strictEqual(pkg.exports['.'].types, './dist/index.d.mts');
        nodeAssert.ok(pkg.types, 'a top-level `types` is needed by legacy resolvers');
        nodeAssert.strictEqual(pkg.types, pkg.exports['.'].types);
    });

    test('the declared entry points exist after a build', () => {
        for (const entry of [pkg.exports['.'].types, pkg.exports['.'].import]) {
            nodeAssert.ok(
                existsSync(join(projectRoot, entry)),
                `${entry} is missing; run \`npm run build\``
            );
        }
    });

    test('a consumer resolves the declarations under every resolution mode', (t) => {
        if (!existsSync(tscPath)) {
            t.skip('typescript is not installed');
            return;
        }

        if (!existsSync(join(projectRoot, 'dist', 'index.d.mts'))) {
            t.skip('run `npm run build` first');
            return;
        }

        const dir = mkdtempSync(join(tmpdir(), 'dc-consumer-'));

        try {
            // Lay the package out exactly as npm would install it.
            const installed = join(dir, 'node_modules', '@final-hill', 'decorator-contracts');

            cpSync(join(projectRoot, 'package.json'), join(installed, 'package.json'), {
                recursive: true,
            });
            cpSync(join(projectRoot, 'dist'), join(installed, 'dist'), { recursive: true });

            writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module', private: true }));
            writeFileSync(join(dir, 'main.mts'), consumerSource);

            const modes: Array<[string, string]> = [
                ['nodenext', 'nodenext'],
                ['node16', 'node16'],
                ['bundler', 'preserve'],
                ['node', 'esnext'],
            ];

            for (const [moduleResolution, module] of modes) {
                const { ok, output } = runTsc(dir, moduleResolution, module);

                if (ok) {
                    nodeAssert.fail(
                        `${moduleResolution}: expected the consumer errors, but none were reported ` +
                        '(the package probably resolved to `any`)'
                    );
                }

                // Both deliberate errors must be reported, which proves the
                // declarations loaded and were actually checked.
                nodeAssert.match(output, /TS2345/, `${moduleResolution}: missing the predicate-signature error`);
                nodeAssert.match(output, /TS2322/, `${moduleResolution}: missing the string-to-number error`);
                nodeAssert.doesNotMatch(output, /TS2307/, `${moduleResolution}: could not resolve the module`);
            }
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

/**
 * The entry point is a promise about what a consumer can reach, and the
 * difference is invisible to the type checker: a `@internal` helper reaches the
 * runtime entry through `export *` whether or not it is re-exported on purpose.
 *
 * These helpers take a raw instance and a raw error and return the live
 * declaration, which is the capability `getContractMetadata` exists to deny by
 * returning copies. The module's declaration surface is therefore listed
 * explicitly in `src/index.mts`, and this pins the list.
 */
describe('The entry point exposes the contract surface and not the runtime plumbing', () => {
    const entry = (): string[] => {
        const dist = join(projectRoot, 'dist', 'index.mjs');

        nodeAssert.ok(existsSync(dist), 'run `npm run build` first');

        return JSON.parse(
            execFileSync(process.execPath, [
                '--input-type=module',
                '-e',
                `const m = await import(${JSON.stringify(`file://${dist}`)});`
                + 'console.log(JSON.stringify(Object.keys(m)))',
            ], { encoding: 'utf8' }),
        );
    };

    test('the resolver the proxy and the accessors share stays internal', () => {
        const exported = entry();

        nodeAssert.ok(exported.includes('rescue'), 'the entry point loaded');

        // It takes a raw metadata record and returns the live declaration, which is
        // what `getContractMetadata` exists to deny.
        nodeAssert.ok(!exported.includes('rescueDeclarationOf'), 'runtime plumbing, not API');
    });

    test('the rescue surface it joined keeps its names', () => {
        const exported = entry();

        for (const name of ['rescue', 'getRescueDeclaration', 'applyRescueHandler'])
            nodeAssert.ok(exported.includes(name), `${name} was already exported`);
        for (const name of ['getContractMetadata', 'getFeatureContracts'])
            nodeAssert.ok(exported.includes(name), `${name} is missing from the entry point`);
    });

    test('the class-name resolver stays internal while its symbol is published', () => {
        const exported = entry();

        nodeAssert.ok(exported.includes('contractName'), 'the declaration symbol is the API');
        // A consumer building a diagnostic already holds the constructor it would pass
        // here, so the resolver is plumbing rather than a capability the surface owes.
        nodeAssert.ok(!exported.includes('classNameOf'), 'runtime plumbing, not API');
    });
});
