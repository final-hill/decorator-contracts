/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Contracted } from '../';

// https://github.com/final-hill/decorator-contracts/issues/35
describe('Public properties must be forbidden', () => {
    test('No public properties okay', () => {
        class Point2D extends Contracted() {
            #x: number;
            #y: number;

            constructor(x: number, y: number) {
                super();
                this.#x = x;
                this.#y = y;
            }

            get x(): number { return this.#x; }
            set x(value: number) { this.#x = value; }

            get y(): number { return this.#y; }
            set y(value: number) { this.#y = value; }
        }

        expect(() => new Point2D(12, 5)).not.toThrow();
    });

    test('Public properties throw', () => {
        class Point2D extends Contracted() {
            constructor(
                public x: number,
                public y: number
            ) { super(); }
        }

        expect(() => new Point2D(12, 5)).toThrow();
    });
});