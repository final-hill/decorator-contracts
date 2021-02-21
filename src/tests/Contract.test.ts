/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {checkedMode, Contract} from '../Contract';

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
describe('A contract must be independently definable', () => {

    test('Well typed contract', () => {
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

    test('Specify and number of \'demands\' assertions on features', () => {
        let stackContract = new Contract<StackType<any>>({
            pop: {
                demands: undefined
            }
        });
        expect(stackContract.assertions.pop!.demands).toBeUndefined();

        stackContract = new Contract<StackType<any>>({
            pop: {
                demands: []
            }
        });
        expect(stackContract.assertions.pop!.demands).toBeInstanceOf(Array);
        expect(stackContract.assertions.pop!.demands!.length).toBe(0);

        stackContract = new Contract<StackType<any>>({
            pop: {
                demands: self => !self.isEmpty()
            }
        });
        expect(stackContract.assertions.pop!.demands).toBeInstanceOf(Function);

        stackContract = new Contract<StackType<any>>({
            pop: {
                demands: [
                    self => !self.isEmpty()
                ]
            }
        });
        expect(stackContract.assertions.pop!.demands).toBeInstanceOf(Array);
        expect(stackContract.assertions.pop!.demands!.length).toBe(1);
        expect((stackContract.assertions.pop!.demands as any[])[0]).toBeInstanceOf(Function);

        stackContract = new Contract<StackType<any>>({
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

    test('Specify and number of \'ensures\' assertions on features', () => {
        let stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: undefined
            }
        });
        expect(stackContract.assertions.pop!.ensures).toBeUndefined();

        stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: []
            }
        });

        expect(stackContract.assertions.pop!.ensures).toBeInstanceOf(Array);
        expect(stackContract.assertions.pop!.ensures!.length).toBe(0);

        stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: (self,old) => self.size == old.size - 1
            }
        });

        expect(stackContract.assertions.pop!.ensures).toBeInstanceOf(Function);

        stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: [(self,old) => self.size == old.size - 1]
            }
        });

        expect(stackContract.assertions.pop!.ensures).toBeInstanceOf(Array);
        expect(stackContract.assertions.pop!.ensures!.length).toBe(1);
        expect((stackContract.assertions.pop!.ensures! as any[])[0]).toBeInstanceOf(Function);

        stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: [
                    (self,old) => self.size == old.size - 1,
                    self => !self.isFull()
                ]
            }
        });
        const ensures = stackContract.assertions.pop!.ensures;

        expect(ensures).toBeInstanceOf(Array);
        expect(ensures!.length).toBe(2);
        expect((ensures as any[])[0]).toBeInstanceOf(Function);
        expect((ensures! as any[])[1]).toBeInstanceOf(Function);
    });

    test('Specify a "rescue" on features', () => {
        let stackContract = new Contract<StackType<any>>({
            push: {
                rescue: undefined
            }
        });
        expect(stackContract.assertions.pop?.rescue).toBeUndefined();

        stackContract = new Contract<StackType<any>>({
            push: {
                rescue: (_self, _error, _args, _retry) => {}
            }
        });
        expect(stackContract.assertions.push?.rescue).toBeInstanceOf(Function);
    });

    // https://github.com/final-hill/decorator-contracts/issues/179
    test('Specify a \'checkedMode\' declaration', () => {
        const stackContract = new Contract<StackType<any>>({
            [checkedMode]: true
        });

        expect(stackContract.assertions[checkedMode]).toBeTruthy();
    });
});
