/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {checkedMode, Contract, extend} from '../';

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

    test('Specify \'demands\' assertion on features', () => {
        let stackContract = new Contract<StackType<any>>({
            pop: {
                demands: undefined
            },
            push: {
                // @ts-expect-error
                demands: false
            }
        });
        expect(stackContract.assertions.pop!.demands).toBeInstanceOf(Function);

        stackContract = new Contract<StackType<any>>({
            pop: {
                demands(){ return true; }
            }
        });
        expect(stackContract.assertions.pop!.demands).toBeInstanceOf(Function);
    });

    test('Specify \'ensures\' assertion on features', () => {
        let stackContract = new Contract<StackType<any>>({
            pop: {
                ensures: undefined
            },
            push: {
                // @ts-expect-error
                ensures: false
            }
        });
        expect(stackContract.assertions.pop!.ensures).toBeInstanceOf(Function);

        stackContract = new Contract<StackType<any>>({
            pop: {
                ensures(){ return true; }
            }
        });

        expect(stackContract.assertions.pop!.ensures).toBeInstanceOf(Function);
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
                rescue(_self, _error, _args, _retry) {}
            },
            pop: {
                // @ts-expect-error
                rescue: false
            }
        });
        expect(stackContract.assertions.push?.rescue).toBeInstanceOf(Function);
    });

    // https://github.com/final-hill/decorator-contracts/issues/179
    test('Specify a \'checkedMode\' declaration', () => {
        const stackContract = new Contract<StackType<any>>({
            [checkedMode]: true
        });

        expect(stackContract[checkedMode]).toBeTruthy();
    });

    test('Specify an \'extend\' declaration', () => {
        const stackContract = new Contract<StackType<any>>({
            [checkedMode]: true
        }),
        subContract = new Contract<StackType<any>>({
            [extend]: stackContract
        });

        expect(subContract[extend]).toBeDefined();
    });
});
