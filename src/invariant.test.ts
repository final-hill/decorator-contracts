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

// https://github.com/final-hill/decorator-contracts/issues/178
describe('There can be multiple invariants assigned to a contract', () => {
    test('', () => {
        let stackContract = new Contract<StackType<any>>();

        expect(stackContract).toBeDefined();

        stackContract = new Contract<StackType<any>>({
            [invariant]: []
        });

        expect(stackContract.assertions[invariant]).toBeInstanceOf(Array);
        expect(stackContract.assertions[invariant]!.length).toBe(0);

        stackContract = new Contract<StackType<any>>({
            [invariant]: [
                self => self.isEmpty() == (self.size == 0),
                self => self.isFull() == (self.size == self.limit),
                self => self.size >= 0 && self.size <= self.limit
            ]
        });

        expect(stackContract.assertions[invariant]).toBeInstanceOf(Array);
        expect(stackContract.assertions[invariant]!.length).toBe(3);
        expect((stackContract.assertions[invariant]! as any[])[0]).toBeInstanceOf(Function);
        expect((stackContract.assertions[invariant]! as any[])[1]).toBeInstanceOf(Function);
        expect((stackContract.assertions[invariant]! as any[])[2]).toBeInstanceOf(Function);

        stackContract = new Contract<StackType<any>>({
            [invariant]: self =>
                self.isEmpty() == (self.size == 0) &&
                self.isFull() == (self.size == self.limit) &&
                self.size >= 0 && self.size <= self.limit
        });

        expect(typeof stackContract.assertions[invariant]!).toBe('function');
    });
});

describe('Invariants are evaluated after the associated class is constructed', () => {
    // TODO
});