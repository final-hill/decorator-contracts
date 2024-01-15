/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import iff from '../iff.mjs';

// https://github.com/final-hill/decorator-contracts/issues/225
describe('Biconditional tests', () => {
    test('Truth Table', () => {
        /*
            p    q    p ↔ q
            ---------------
            T    T      T
            T    F      F
            F    T      F
            F    F      T
        */
        expect(iff(true, true)).toBe(true);
        expect(iff(true, false)).toBe(false);
        expect(iff(false, true)).toBe(false);
        expect(iff(false, false)).toBe(true);
    });
});