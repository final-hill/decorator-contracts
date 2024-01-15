/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import implies from '../implies.mjs';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

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
        nodeAssert.strictEqual(implies(true, true), true);
        nodeAssert.strictEqual(implies(true, false), false);
        nodeAssert.strictEqual(implies(false, true), true);
        nodeAssert.strictEqual(implies(false, false), true);
    });
});