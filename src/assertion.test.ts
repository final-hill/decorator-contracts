/*!
 * Decorator Contracts v0.0.0 | Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import assertion from './assertion';
import AssertionError from './AssertionError';

describe('debug assertions should execute', () => {
    let assert = assertion(true);

    const X = 15;

    test(`assert(X > 5) === true`, () => {
        expect(assert(X > 5)).toBe(true);
    });

    test(`assert(X > 200) throws AssertionError`, () => {
        expect(() => assert(X > 200)).toThrow(AssertionError);
    });

    test(`assert(X > 200, 'Assertion Failed') throws AssertionError('Assertion Failed')`, () => {
        expect(() => assert(X > 200, 'Assertion Failed')).toThrow('Assertion Failed');
    });
});

describe('prod assertions should be NOOPs', () => {
    let assert = assertion(false);

    const X = 15;

    test(`assert(X > 5) === true`, () => {
        expect(assert(X < 5)).toBe(true);
    });

    test(`assert(X > 200) === true`, () => {
        expect(assert(X > 200)).toBe(true);
    });

    test(`assert(X > 200, 'Assertion Failed') === true`, () => {
        expect(assert(X > 200)).toBe(true);
    });
});