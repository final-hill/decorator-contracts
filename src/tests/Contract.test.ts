/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { MSG_BAD_SUBCONTRACT, MSG_SINGLE_CONTRACT } from '../Messages';
import {Contracted, checkedMode, Contract, extend} from '../';

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

// https://github.com/final-hill/decorator-contracts/issues/181
describe('Only a single contract can be assigned to a class', () => {
    test('Good declaration', () => {
        expect(() => {
            const fooContract = new Contract<Foo>(),
            barContract = new Contract<Bar>({
                [extend]: fooContract
            });

            @Contracted(fooContract)
            class Foo {}

            @Contracted(barContract)
            class Bar extends Foo{}

            return new Bar();
        }).not.toThrow();
    });

    test('Bad Declaration', () => {
        expect(() => {
            const fooContract = new Contract(),
                barContract = new Contract();
            @Contracted(fooContract)
            @Contracted(barContract)
            class Foo {}

            return new Foo();
        }).toThrow(MSG_SINGLE_CONTRACT);
    });
});

// https://github.com/final-hill/decorator-contracts/issues/193
describe('An abstract class must support contract declarations', () => {
    test('Concrete declaration', () => {
        expect(() => {
            const baseContract = new Contract<Base>({});
            @Contracted(baseContract)
            class Base {}

            return Base;
        }).toBeDefined();
    });

    test('Abstract declaration', () => {
        expect(() => {
            const baseContract = new Contract<Base>({});
            @Contracted(baseContract)
            abstract class Base {}

            return Base;
        }).toBeDefined();
    });
});

// https://github.com/final-hill/decorator-contracts/issues/187
describe('A subclass can only be contracted by a subcontract of the base class contract', () => {
    test('Good', () => {
        expect(() => {
            const fooContract = new Contract<Foo>({});

            @Contracted(fooContract)
            class Foo {}

            const barContract = new Contract<Bar>({
                [extend]: fooContract
            });

            @Contracted(barContract)
            class Bar {}

            return Bar;
        }).not.toThrow();
    });

    test('Bad - missing extends', () => {
        const fooContract = new Contract<Foo>({});

        @Contracted(fooContract)
        class Foo {}

        expect(() => {
            const badContract =  new Contract<Bar>({});
            @Contracted(badContract)
            class Bar extends Foo {}
        }).toThrow(MSG_BAD_SUBCONTRACT);

    });
});