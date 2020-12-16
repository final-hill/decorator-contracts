/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import getAncestry from './getAncestry';

describe('getAncestry', () => {
    test('Object', () => {
        const ancestry = getAncestry(Object);
        expect(ancestry.length).toBe(3);
        expect(ancestry[0]).toBe(Object);
        expect(ancestry[1]).toBe(Function.prototype);
        expect(ancestry[2]).toBe(Object.prototype);
    });
    test('Array', () => {
        const ancestry = getAncestry(Array);
        expect(ancestry.length).toBe(3);
        expect(ancestry[0]).toBe(Array);
        expect(ancestry[1]).toBe(Function.prototype);
        expect(ancestry[2]).toBe(Object.prototype);
    });
    test('User Class', () => {
        class A {}
        class B extends A {}
        class C extends B {}

        const ancestry = getAncestry(C);
        expect(ancestry.length).toBe(5);
        expect(ancestry[0]).toBe(C);
        expect(ancestry[1]).toBe(B);
        expect(ancestry[2]).toBe(A);
        expect(ancestry[3]).toBe(Function.prototype);
        expect(ancestry[4]).toBe(Object.prototype);
    });
});