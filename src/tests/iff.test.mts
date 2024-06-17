/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import iff from '../iff.mjs';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

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
        nodeAssert.strictEqual(iff(true, true), true);
        nodeAssert.strictEqual(iff(true, false), false);
        nodeAssert.strictEqual(iff(false, true), false);
        nodeAssert.strictEqual(iff(false, false), true);
    });
});