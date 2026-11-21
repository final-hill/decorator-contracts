import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * https://github.com/final-hill/decorator-contracts/issues/291
 *
 * `exports.types` pointed at `./dist/index.d.ts`, but the build emits
 * `index.d.mts`. Modern resolutions recovered by falling back, so this only
 * failed for `moduleResolution: "node"` — where the whole module came back as
 * `any`, silently disabling type checking for every consumer.
 *
 * This packs the package and type-checks a consumer against it, so the
 * published artifacts are actually exercised rather than the working tree.
 */

const projectRoot = resolve(import.meta.dirname, '..', '..');

const readProjectPackage = (): any =>
    JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

/**
 * A consumer file that only type-checks correctly if the real declarations
 * load. `demands` with a single-parameter predicate is a compile error in the
 * published types, and a deliberate `string`-to-`number` assignment catches a
 * package that resolves to `any`.
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

const runTsc = (cwd: string, moduleResolution: string, module: string): { ok: boolean, output: string } => {
    writeFileSync(join(cwd, 'tsconfig.json'), JSON.stringify({
        compilerOptions: {
            target: 'ES2024',
            module,
            moduleResolution,
            strict: true,
            noEmit: true,
            skipLibCheck: false,
        },
        include: ['main.mts'],
    }));

    try {
        execFileSync('npx', ['tsc', '-p', 'tsconfig.json'], { cwd, encoding: 'utf8', stdio: 'pipe' });
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
            nodeAssert.ok(existsSync(join(projectRoot, entry)), `${entry} is missing; run \`npm run build\``);
        }
    });

    test('a consumer resolves the declarations under every resolution mode', (t) => {
        // `dist` must exist; `pretest` builds, but this file may be run directly.
        if (!existsSync(join(projectRoot, 'dist', 'index.d.mts'))) {
            t.skip('run `npm run build` first');
            return;
        }

        const dir = mkdtempSync(join(tmpdir(), 'dc-consumer-'));

        try {
            writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'consumer', type: 'module', private: true }));
            writeFileSync(join(dir, 'main.mts'), consumerSource);

            // Pack the package exactly as it would be published.
            const tarball = execFileSync('npm', ['pack', projectRoot, '--silent'], { cwd: dir, encoding: 'utf8' })
                .trim()
                .split('\n')
                .pop()!;

            execFileSync('npm', [
                'install',
                './' + tarball,
                'typescript@5',
                '--silent',
                '--no-audit',
                '--no-fund',
            ], { cwd: dir, stdio: 'pipe' });

            const modes: Array<[string, string]> = [
                ['nodenext', 'nodenext'],
                ['node16', 'node16'],
                ['bundler', 'preserve'],
                ['node', 'esnext'],
            ];

            for (const [moduleResolution, module] of modes) {
                const { ok, output } = runTsc(dir, moduleResolution, module);

                if (ok) {
                    nodeAssert.fail(`${moduleResolution}: expected the consumer errors, but none were reported (declarations likely resolved to \`any\`)`);
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
