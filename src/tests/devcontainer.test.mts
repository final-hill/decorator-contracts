import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * https://github.com/final-hill/decorator-contracts/issues/295
 *
 * A development container pins the local Node version. If it drifts from
 * `engines.node` or from CI, "works on my machine" returns: the container can
 * pass while CI fails, or vice versa.
 *
 * These tests read the devcontainer configuration and compare it with the other
 * two places the version is declared.
 */

const projectRoot = resolve(import.meta.dirname, '..', '..'),
    read = (file: string): string => readFileSync(join(projectRoot, file), 'utf8'),
    readJson = (file: string): any => JSON.parse(read(file));

/** Strips `//` comments, which `devcontainer.json` allows. */
const readDevcontainer = (): any =>
    JSON.parse(read('.devcontainer/devcontainer.json').replace(/^\s*\/\/.*$/gm, ''));

const enginesFloor = (): number => {
    const { engines } = readJson('package.json'),
        match = />=?\s*(\d+)/.exec(engines?.node ?? '');

    nodeAssert.ok(match, '`engines.node` must declare a floor');

    return Number(match[1]);
};

const ciNodeMajors = (): number[] => {
    const contents = read(join('.github', 'workflows', 'build.yml'));

    return [...contents.matchAll(/(\d+)\.x/g)].map(match => Number(match[1]));
};

describe('The development container exists', () => {
    test('`.devcontainer/devcontainer.json` is present', () => {
        nodeAssert.ok(existsSync(join(projectRoot, '.devcontainer', 'devcontainer.json')));
    });

    test('it is valid JSON once comments are stripped', () => {
        nodeAssert.doesNotThrow(() => readDevcontainer());
    });

    test('it installs dependencies on create', () => {
        nodeAssert.match(readDevcontainer().postCreateCommand ?? '', /npm ci\b/);
    });

    test('it recommends the extensions this repository relies on', () => {
        const extensions: string[] = readDevcontainer().customizations?.vscode?.extensions ?? [],
            recommended: string[] = JSON.parse(
                read(join('.vscode', 'extensions.json')).replace(/^\s*\/\/.*$/gm, '')
            ).recommendations ?? [];

        for (const extension of recommended)
            nodeAssert.ok(
                extensions.includes(extension),
                `${extension} is recommended for the workspace but not installed in the container`
            );
    });
});

describe('The container pins the same Node version as CI and `engines`', () => {
    test('the image tag matches the declared floor', () => {
        const image: string = readDevcontainer().image,
            floor = enginesFloor();

        nodeAssert.match(image, new RegExp(`:${floor}\\b`), `image "${image}" does not pin Node ${floor}`);
    });

    test('CI targets the same major', () => {
        const floor = enginesFloor();

        nodeAssert.ok(
            ciNodeMajors().includes(floor),
            `CI tests ${ciNodeMajors().join(', ')} but the floor is ${floor}`
        );
    });

    test('the container does not use a floating tag', () => {
        const image: string = readDevcontainer().image;

        nodeAssert.doesNotMatch(image, /:latest$/);
        nodeAssert.match(image, /:\d+$/);
    });
});

describe('Editor settings work on a POSIX filesystem', () => {
    test('`typescript.tsdk` is a relative path, not a Windows path', () => {
        const tsdk: string = readJson(join('.vscode', 'settings.json'))['typescript.tsdk'];

        nodeAssert.doesNotMatch(tsdk, /\\\\/, 'a backslash path does not resolve in the container');
        nodeAssert.strictEqual(tsdk, 'node_modules/typescript/lib');
    });
});
