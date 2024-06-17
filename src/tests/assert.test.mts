/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import AssertionError from '../AssertionError.mjs';
import assert from '../assert.mjs';

/**
 * https://github.com/final-hill/decorator-contracts/issues/21
 */
describe('The assertion function must support assertion signatures from TypeScript 3.7+', () => {
    test('Test assertion', () => {
        nodeAssert.strictEqual(assert(true), undefined);
        nodeAssert.throws(() => assert(false), AssertionError);

        const a: any = 'foo';

        // No type error
        let b = 5 * a;

        assert(typeof a === 'string');

        // @ts-expect-error
        b = 5 * a;

        nodeAssert(b !== undefined);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/22
 */
describe('Assertions must support throwing custom error types', () => {
    nodeAssert.throws(() => assert(false, 'BOOM!'), AssertionError);
    nodeAssert.throws(() => assert(false, 'BOOM!'), { message: 'BOOM!' });
    nodeAssert.throws(() => assert(false, 'BOOM!', TypeError), TypeError);
});