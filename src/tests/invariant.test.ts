/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {AssertionError, checkedMode, Contract, Contracted, invariant, override} from '../';

interface StackType<T> {
    readonly limit: number;
    readonly size: number;
    clear(): void;
    isEmpty(): boolean;
    isFull(): boolean;
    pop(): T;
    push(item: T): void;
    top(): T;
}

// https://github.com/final-hill/decorator-contracts/issues/30
describe('The subclasses of a contracted class must obey the invariants', () => {
    test('Test subclassing in debug mode', () => {
        const fooContract: Contract<Foo> = new Contract<Foo>({
            [checkedMode]: true,
            [invariant]: self => self.value >= 0
        });

        class Foo extends Contracted(fooContract) {
            #value = 0;

            get value(): number { return this.#value; }
            set value(value: number) { this.#value = value; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        class Bar extends Foo {}

        expect(() => {
            const bar = new Bar();
            bar.inc();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.dec();
        }).toThrow(AssertionError);

        expect(() => {
            const bar = new Bar();
            bar.value = 3;
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();

            return bar.value == 0;
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.value = -1;
        }).toThrow(AssertionError);

        // overriding members
        class Baz extends Foo {
            @override
            get value(): number { return super.value; }
            set value(value: number) { super.value = value; }

            @override
            inc(): void { super.value++; }
            @override
            dec(): void { super.value--; }
        }

        expect(() => {
            const baz = new Baz();
            baz.inc();
            baz.dec();
        }).not.toThrow();

        expect(() => {
            const baz = new Baz();
            baz.dec();
        }).toThrow(AssertionError);

        expect(() => {
            const baz = new Baz();
            baz.value = 3;
        }).not.toThrow();

        expect(() => {
            const baz = new Baz();

            return baz.value == 0;
        }).not.toThrow();

        expect(() => {
            const baz = new Baz();
            baz.value = -1;
        }).toThrow(AssertionError);
    });

    test('Test subclassing in prod mode', () => {
        const fooContract: Contract<Foo> = new Contract<Foo>({
            [checkedMode]: false,
            [invariant]: self => self.value >= 0
        });

        class Foo extends Contracted(fooContract) {
            #value = 0;

            get value(): number { return this.#value; }
            set value(value: number) { this.#value = value; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        class Bar extends Foo {}

        expect(() => {
            const bar = new Bar();
            bar.inc();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.value = 3;
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();

            return bar.value == 0;
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.value = -1;
        }).not.toThrow();
    });
});

// https://github.com/final-hill/decorator-contracts/issues/178
describe('There can be multiple invariants assigned to a contract', () => {
    test('', () => {
        let stackContract = new Contract<StackType<any>>();

        expect(stackContract).toBeDefined();

        stackContract = new Contract<StackType<any>>({
            [invariant]: []
        });

        expect(stackContract[invariant]).toBeInstanceOf(Array);
        expect(stackContract[invariant]!.length).toBe(0);

        stackContract = new Contract<StackType<any>>({
            [invariant]: [
                self => self.isEmpty() == (self.size == 0),
                self => self.isFull() == (self.size == self.limit),
                self => self.size >= 0 && self.size <= self.limit
            ]
        });

        expect(stackContract[invariant]).toBeInstanceOf(Array);
        expect(stackContract[invariant].length).toBe(3);
        expect(stackContract[invariant][0]).toBeInstanceOf(Function);
        expect(stackContract[invariant][1]).toBeInstanceOf(Function);
        expect(stackContract[invariant][2]).toBeInstanceOf(Function);

        stackContract = new Contract<StackType<any>>({
            [invariant]: self =>
                self.isEmpty() == (self.size == 0) &&
                self.isFull() == (self.size == self.limit) &&
                self.size >= 0 && self.size <= self.limit
        });

        expect(stackContract[invariant]).toBeInstanceOf(Array);
        expect(stackContract[invariant].length).toBe(1);
        expect(stackContract[invariant][0]).toBeInstanceOf(Function);
    });
});

describe('Invariants are evaluated after the associated class is constructed', () => {
    // TODO
});