/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {Contract, invariant} from './Contract';

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

// https://github.com/final-hill/decorator-contracts/issues/171
describe('A contract must be defined independently from a class', () => {
    test('Contract declaration', () => {
        expect(new Contract()).toBeDefined();
    });
});

// https://github.com/final-hill/decorator-contracts/issues/172
describe('A contract declaration can specify any number of class invariants', () => {
    expect(new Contract<StackType<any>>()).toBeDefined();

    expect(new Contract<StackType<any>>({
        [invariant]: [
            self => self.isEmpty() == (self.size == 0),
            self => self.isFull() == (self.size == self.limit),
            self => self.size >= 0 && self.size <= self.limit
        ]
    }).assertions[invariant]!.length).toBe(3);

    expect(typeof new Contract<StackType<any>>({
        [invariant]: self =>
            self.isEmpty() == (self.size == 0) &&
            self.isFull() == (self.size == self.limit) &&
            self.size >= 0 && self.size <= self.limit
    }).assertions[invariant]!).toBe('function');
});

// https://github.com/final-hill/decorator-contracts/issues/174
describe('The assertions of a contract declaration must be able to reference a class in a well-typed manner', () => {
    // No type errors expected. no any type expected
    expect(new Contract<StackType<any>>({
        [invariant]: [
            self => self.isEmpty() == (self.size == 0),
            self => self.isFull() == (self.size == self.limit),
            self => self.size >= 0 && self.size <= self.limit
        ]
    }).assertions[invariant]!.length).toBe(3);
});

// https://github.com/final-hill/decorator-contracts/issues/175
describe('A contract declaration must be able to specify the features of its associated class type', () => {
    const stackContract = new Contract<StackType<any>>({
        pop: {},
        push: {},
        // @ts-expect-error
        foo: {}
    });

    expect(stackContract.assertions.pop).toBeDefined();
    expect(stackContract.assertions.push).toBeDefined();
    // @ts-expect-error
    expect(stackContract.assertions.foo);
});

// https://github.com/final-hill/decorator-contracts/issues/176
describe('Each feature of a contract declaration must be able to define any number \'demands\' assertions', () => {
    test('undefined demands', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                demands: undefined
            }
        });

        expect(stackContract.assertions.pop!.demands).toBeUndefined();
    });

    test('Empty demands', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                demands: []
            }
        });

        expect(stackContract.assertions.pop!.demands).toBeDefined();
        expect(stackContract.assertions.pop!.demands!.length).toBe(0);
    });

    test('Single demand', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                demands: self => !self.isEmpty()
            }
        });

        expect(stackContract.assertions.pop!.demands).toBeDefined();
        expect(stackContract.assertions.pop!.demands).toBeInstanceOf(Function);
    });

    test('Single demand in array', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                demands: [
                    self => !self.isEmpty()
                ]
            }
        });

        expect(stackContract.assertions.pop!.demands).toBeDefined();
        expect(stackContract.assertions.pop!.demands).toBeInstanceOf(Array);
        expect(stackContract.assertions.pop!.demands!.length).toBe(1);
        expect((stackContract.assertions.pop!.demands as any[])[0]).toBeInstanceOf(Function);
    });

    test('Multiple demands', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                demands: [
                    self => !self.isEmpty(),
                    self => self.size > 0
                ]
            }
        });

        expect(stackContract.assertions.pop!.demands).toBeInstanceOf(Array);
        expect(stackContract.assertions.pop!.demands!.length).toBe(2);
        expect((stackContract.assertions.pop!.demands as any[])[0]).toBeInstanceOf(Function);
        expect((stackContract.assertions.pop!.demands as any[])[1]).toBeInstanceOf(Function);
    });
});

// https://github.com/final-hill/decorator-contracts/issues/177
describe('Each feature of a contract declaration must be able to define any number \'ensures\' assertions #177', () => {

    test('undefined ensures', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: undefined
            }
        });

        expect(stackContract.assertions.pop!.ensures).toBeUndefined();
    });

    test('empty ensures array', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: []
            }
        });

        expect(stackContract.assertions.pop!.ensures).toBeInstanceOf(Array);
        expect(stackContract.assertions.pop!.ensures!.length).toBe(0);
    });

    test('single assertion', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: (self,old) => self.size == old.size - 1
            }
        });

        expect(stackContract.assertions.pop!.ensures).toBeInstanceOf(Function);
    });

    test('single assertion in array', () => {
        const stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: [(self,old) => self.size == old.size - 1]
            }
        });

        expect(stackContract.assertions.pop!.ensures).toBeInstanceOf(Array);
        expect(stackContract.assertions.pop!.ensures!.length).toBe(1);
        expect((stackContract.assertions.pop!.ensures! as any[])[0]).toBeInstanceOf(Function);

    });

    test('multiple assertions in array', () => {
       const stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: [
                    (self,old) => self.size == old.size - 1,
                    self => !self.isFull()
                ]
            }
        }),
        ensures = stackContract.assertions.pop!.ensures;

        expect(ensures).toBeInstanceOf(Array);
        expect(ensures!.length).toBe(2);
        expect((ensures as any[])[0]).toBeInstanceOf(Function);
        expect((ensures! as any[])[1]).toBeInstanceOf(Function);
    });
});