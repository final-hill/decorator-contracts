/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import AssertionError from './AssertionError';
import Assertion from './Assertion';

/**
 * https://github.com/final-hill/decorator-contracts/issues/8
 */
describe('Assertions must be toggleable', () => {
    test('false assertions', () => {
        const assertDebug: Assertion['assert'] = new Assertion(true).assert,
              assertProd: Assertion['assert'] = new Assertion(false).assert;

        expect(() => assertDebug(false)).toThrow(AssertionError);
        expect(() => assertProd(false)).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/22
 */
describe('Assertions must support throwing custom error types', () => {
    const assert: Assertion['assert'] = new Assertion(true).assert,
        fn = (): void => assert(false, 'BOOM!');

    expect(fn).toThrow(AssertionError);
    expect(fn).toThrowError('BOOM!');
});