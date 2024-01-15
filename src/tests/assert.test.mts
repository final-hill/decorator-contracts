/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import AssertionError from '../AssertionError.mjs';
import assert from '../assert.mjs';

/**
 * https://github.com/final-hill/decorator-contracts/issues/21
 */
describe('The assertion function must support assertion signatures from TypeScript 3.7+', () => {
    test('Test assertion', () => {
        expect(assert(true)).toBe(undefined);
        expect(() => assert(false)).toThrow();

        const a: any = 'foo';

        // No type error
        let b = 5 * a;

        assert(typeof a === 'string');

        // @ts-expect-error
        b = 5 * a;

        expect(b).toBeDefined();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/22
 */
describe('Assertions must support throwing custom error types', () => {
    expect(() => assert(false, 'BOOM!')).toThrow(AssertionError);
    expect(() => assert(false, 'BOOM!')).toThrowError('BOOM!');
    expect(() => assert(false, 'BOOM!', TypeError)).toThrow(TypeError);
});