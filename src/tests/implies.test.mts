/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import implies from '../implies.mjs';

// https://github.com/final-hill/decorator-contracts/issues/225
describe('Material Implication tests', () => {
    test('Truth Table', () => {
        /*
            p    q    p → q
            ---------------
            T    T      T
            T    F      F
            F    T      T
            F    F      T
        */
        expect(implies(true, true)).toBe(true);
        expect(implies(true, false)).toBe(false);
        expect(implies(false, true)).toBe(true);
        expect(implies(false, false)).toBe(true);
    });
});