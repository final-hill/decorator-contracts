/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

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
        expect(new Spinner().spinLock(50)).toBe('Okay');
        expect(() => new Spinner().spinLock(500)).toThrow(/^Timing constraint violated/);
    });
});