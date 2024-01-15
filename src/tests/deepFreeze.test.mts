/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { deepFreeze } from '../lib/index.mjs';

describe('deepFreeze testing', () => {
    test('Shallow test', () => {
        const obj = {
            prop: 42
        };

        deepFreeze(obj);
        expect(() => obj.prop = 33).toThrow();
    });

    test('Deep test', () => {
        const obj = {
            prop1: {
                prop2: 42
            }
        };

        deepFreeze(obj);
        expect(() => obj.prop1.prop2 = 33).toThrow();
    });
});