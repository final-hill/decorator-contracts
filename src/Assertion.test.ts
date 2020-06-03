/*!
 * @license
 * Copyright (C) 2020 Michael L Haufe
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import AssertionError from './AssertionError';
import Contracts from './';

/**
 * https://github.com/final-hill/decorator-contracts/issues/8
 */
describe('Assertions must be toggleable', () => {
    test('false assertions', () => {
        const {assert: assertDebug} = new Contracts(true),
            {assert: assertProd} = new Contracts(false);

        expect(() => assertDebug(false)).toThrow(AssertionError);
        expect(() => assertProd(false)).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/22
 */
describe('Assertions must support throwing custom error types', () => {
    const assert: Contracts['assert'] = new Contracts(true).assert,
        fn = (): void => assert(false, 'BOOM!');

    expect(fn).toThrow(AssertionError);
    expect(fn).toThrowError('BOOM!');
});
