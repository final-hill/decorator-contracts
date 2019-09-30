/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Unit testing for the assertion function
 */

import AssertionError from './AssertionError';
import Contracts from './';

/**
 * Requirement 169
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/69
 */
describe('Assertions must support a means of enabling/disabling', () => {
    test('false assertions', () => {
        let {assert: assertDebug} = new Contracts(true),
            {assert: assertProd} = new Contracts(false);

        expect(() => assertDebug(false)).toThrow(AssertionError);
        expect(() => assertProd(false)).not.toThrow();
    });
});
