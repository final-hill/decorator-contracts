import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * https://github.com/final-hill/decorator-contracts/issues/293
 *
 * The build used to lint with `fix: true`, and `prebuild` ran `eslint --fix`.
 * A build therefore rewrote tracked files, so the working tree could silently
 * disagree with what was committed, and CI's autofix masked findings instead of
 * failing on them.
 *
 * These tests pin the configuration, and demonstrate the behaviour with a
 * temporary copy of a source file so nothing in the repo is touched.
 */

const projectRoot = resolve(import.meta.dirname, '..', '..'),
    readJson = (file: string): any => JSON.parse(readFileSync(join(projectRoot, file), 'utf8'));

describe('The build does not rewrite source files', () => {
    const pkg = readJson('package.json'),
        webpackConfig = readFileSync(join(projectRoot, 'webpack.config.mjs'), 'utf8');

    test('the webpack ESLint plugin does not auto-fix', () => {
        nodeAssert.match(webpackConfig, /fix:\s*false/, 'ESLintWebpackPlugin must not have `fix: true`');
        nodeAssert.doesNotMatch(webpackConfig, /fix:\s*true/);
    });

    test('`lint` does not mutate files', () => {
        nodeAssert.doesNotMatch(pkg.scripts.lint, /--fix/, '`npm run lint` must not pass `--fix`');
    });

    test('`lint` fails on warnings, not just errors', () => {
        nodeAssert.match(pkg.scripts.lint, /--max-warnings 0/);
    });

    test('`prebuild` does not autofix', () => {
        nodeAssert.doesNotMatch(pkg.scripts.prebuild ?? '', /--fix|lint:fix/);
    });

    test('an autofix script is available for deliberate use', () => {
        nodeAssert.match(pkg.scripts['lint:fix'] ?? '', /--fix/);
    });
});

describe('Lint reports a fixable violation instead of correcting it', () => {
    /**
     * `prefer-const` is auto-fixable, so it distinguishes "reported" from
     * "silently rewritten" — the behaviour this issue is about.
     *
     * The probe must live inside the project for ESLint to find `eslint.config.js`,
     * so it is written to a uniquely named file under `src/` and removed again.
     * The file is never committed and never matches a test glob.
     */
    const probe = `
export function probeFn() {
    let neverReassigned = 1;
    return neverReassigned;
}
`;

    const eslintBinary = join(projectRoot, 'node_modules', 'eslint', 'bin', 'eslint.js'),
        probeName = 'probe-lint-hygiene.mts';

    const withProbe = async <T,>(action: (file: string) => Promise<T> | T): Promise<T> => {
        const dir = join(projectRoot, 'src', '__probe__'),
            file = join(dir, probeName);

        mkdirSync(dir, { recursive: true });
        writeFileSync(file, probe);

        try {
            return await action(file);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

    const runEslint = (file: string, fix: boolean): number => {
        const args = [eslintBinary, file, '--no-warn-ignored'];

        if (fix) args.push('--fix');

        try {
            execFileSync(process.execPath, args, { cwd: projectRoot, encoding: 'utf8', stdio: 'pipe' });
            return 0;
        } catch (error: any) {
            return error.status ?? 1;
        }
    };

    test('without `--fix` the violation is reported and the source is unchanged', async () => {
        await withProbe(file => {
            const status = runEslint(file, false);

            nodeAssert.notStrictEqual(status, 0, 'a violation must fail the lint');
            nodeAssert.match(readFileSync(file, 'utf8'), /let neverReassigned/, 'the source must be untouched');
        });
    });

    test('with `--fix` the same violation is corrected', async () => {
        await withProbe(file => {
            runEslint(file, true);

            nodeAssert.match(readFileSync(file, 'utf8'), /const neverReassigned/, '`--fix` rewrites the source');
        });
    });
});
