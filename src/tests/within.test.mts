/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contract, Contracted } from '../index.mjs';

// https://github.com/final-hill/decorator-contracts/issues/209
describe('Features should support a time constraint declaration', () => {
    test('synchronous test', () => {
        const timingContract = new Contract<Spinner>({
            spinLock: {
                within: 100
            }
        });

        @Contracted(timingContract)
        class Spinner {
            spinLock(delay: number) {
                const t1 = Date.now();
                while (Date.now() - t1 < delay)
                    continue;

                return 'Okay';
            }
        }
        nodeAssert.strictEqual(new Spinner().spinLock(50), 'Okay');
        nodeAssert.throws(() => new Spinner().spinLock(500), /^Timing constraint violated/);
    });
});