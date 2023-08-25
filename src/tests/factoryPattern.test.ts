/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Contract, Contracted, extend, invariant } from '../';

describe('Factory Pattern', () => {
    const factoryContract = new Contract<Factory>();

    @Contracted(factoryContract)
    class Factory {
        child(value: string) { return new Child(value); }
    }

    const childContract = new Contract<Child>({
        [extend]: factoryContract,
        [invariant](self) { return self.value.length === 1; }
    });

    @Contracted(childContract)
    class Child extends Factory {
        #value: string;

        constructor(value: string) {
            super();
            this.#value = value;
        }

        get value() { return this.#value; }
    }

    test('Construct Child', () => {
        const c = new Child('a');

        expect(c).toBeInstanceOf(Child);
        expect(c.value).toBe('a');
    });

    test('Factory Construct Child', () => {
        const f = new Factory(),
            c = f.child('a');

        expect(c).toBeInstanceOf(Child);
        expect(c.value).toBe('a');
    });
});