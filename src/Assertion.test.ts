/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit testing for the assertion function
 */

import AssertionError from './AssertionError';
import Contracts from './';

/**
 * Requirement 69
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/69
 */
describe('Assertions must support a means of enabling/disabling', () => {
    test('false assertions', () => {
        const {assert: assertDebug} = new Contracts(true),
            {assert: assertProd} = new Contracts(false);

        expect(() => assertDebug(false)).toThrow(AssertionError);
        expect(() => assertProd(false)).not.toThrow();
    });
});

/**
 * Requirement 70
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/70
 */
describe('Assertions must return a boolean in all modes', () => {
    test('return values', () => {
        const {assert: assertDebug} = new Contracts(true),
            {assert: assertProd} = new Contracts(false);

        expect(assertDebug(true)).toBe(true);
        expect(assertProd(true)).toBe(true);
        expect(assertProd(false)).toBe(true);
    });
});

/**
 * Requirement 71
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/71
 */
describe('Assertions must support throwing custom error types', () => {
    const {assert} = new Contracts(true);
    const fn = () => assert(false, 'BOOM!');
    expect(fn).toThrow(AssertionError);
    expect(fn).toThrowError('BOOM!');
});