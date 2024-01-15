/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Messages } from '../Messages.mjs';
import { Contracted } from '../index.mjs';

// https://github.com/final-hill/decorator-contracts/issues/35
describe('Public properties must be forbidden', () => {
    test('No public properties okay', () => {
        @Contracted()
        class Point2D {
            accessor x: number;
            accessor y: number;

            constructor(x: number, y: number) {
                this.x = x;
                this.y = y;
            }
        }

        nodeAssert.doesNotThrow(() => new Point2D(12, 5));
    });

    test('Public properties throw', () => {
        @Contracted()
        class Point2D {
            constructor(
                public x: number,
                public y: number
            ) { }
        }

        nodeAssert.throws(() => new Point2D(12, 5), Messages.MsgNoProperties);
    });
});