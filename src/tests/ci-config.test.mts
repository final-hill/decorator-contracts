import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * https://github.com/final-hill/decorator-contracts/issues/294
 *
 * CI ran only on `windows-latest` with a single Node version, used
 * `npm install` (which repairs the lockfile instead of honouring it), reported
 * no coverage, and the package declared no `engines` range despite depending on
 * decorator metadata.
 *
 * These tests pin the configuration so it cannot quietly narrow again.
 */

const projectRoot = resolve(import.meta.dirname, '..', '..'),
    read = (file: string): string => readFileSync(join(projectRoot, file), 'utf8'),
    readJson = (file: string): any => JSON.parse(read(file));

describe('The package declares the Node versions it supports', () => {
    test('`engines.node` is present', () => {
        const { engines } = readJson('package.json');

        nodeAssert.ok(engines?.node, '`engines.node` must be declared');
    });

    test('`engines.node` has a floor', () => {
        const { engines } = readJson('package.json');

        nodeAssert.match(engines.node, />=\s*\d+/);
    });
});

describe('CI runs on Linux', () => {
    const workflows = ['build.yml', 'build-release.yml'];

    for (const workflow of workflows) {
        test(`${workflow} targets a Linux runner`, () => {
            const contents = read(join('.github', 'workflows', workflow));

            nodeAssert.doesNotMatch(contents, /windows-latest/, 'the runner must not be Windows-only');
            nodeAssert.match(contents, /runs-on:\s*ubuntu-latest/);
        });

        test(`${workflow} installs reproducibly`, () => {
            const contents = read(join('.github', 'workflows', workflow));

            nodeAssert.match(contents, /npm ci\b/, '`npm ci` honours the lockfile; `npm install` repairs it');
        });

        test(`${workflow} runs a Node version inside the declared range`, () => {
            const contents = read(join('.github', 'workflows', workflow)),
                { engines } = readJson('package.json'),
                floor = Number(/>=?\s*(\d+)/.exec(engines.node)?.[1]);

            const versions = [...contents.matchAll(/(\d+)\.x/g)].map(match => Number(match[1]));

            nodeAssert.ok(versions.length > 0, 'no Node version is pinned');

            for (const version of versions)
                nodeAssert.ok(
                    version >= floor,
                    `CI targets Node ${version}, below the declared floor of ${floor}`
                );
        });
    }

    test('the validate matrix tests the floor on a released line', () => {
        const contents = read(join('.github', 'workflows', 'build.yml')),
            { engines } = readJson('package.json'),
            floor = Number(/>=?\s*(\d+)/.exec(engines.node)?.[1]);

        nodeAssert.match(contents, new RegExp(`${floor}\\.x`), 'the declared floor itself must be tested');

        // Every matrix entry must be at or above the floor. The next major is
        // deliberately not listed: it would resolve to an alpha.
        const versions = [...contents.matchAll(/(\d+)\.x/g)].map(match => Number(match[1]));

        for (const version of versions)
            nodeAssert.ok(version >= floor, `Node ${version} is below the declared floor of ${floor}`);
    });
});

describe('Coverage is collected', () => {
    const pkg = readJson('package.json');

    test('a coverage script exists', () => {
        nodeAssert.match(pkg.scripts['test:coverage'] ?? '', /--experimental-test-coverage/);
    });

    test('coverage is emitted as lcov', () => {
        nodeAssert.match(pkg.scripts['test:coverage'] ?? '', /--test-reporter=lcov/);
    });

    test('the coverage script creates its output directory', () => {
        // Node fails with ENOENT writing the lcov file if the directory is absent.
        nodeAssert.match(pkg.scripts['pretest:coverage'] ?? '', /mkdirSync\('coverage'/);
    });

    test('the coverage script builds first, so `dist/` exists for the suite', () => {
        nodeAssert.match(pkg.scripts['pretest:coverage'] ?? '', /npm run build/);
    });

    test('CI uploads the coverage artifact', () => {
        const contents = read(join('.github', 'workflows', 'build.yml'));

        nodeAssert.match(contents, /actions\/upload-artifact/);
        nodeAssert.match(contents, /coverage\//);
    });
});
