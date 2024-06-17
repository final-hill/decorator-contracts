/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Messages } from '../Messages.mjs';
import { Contracted, checkedMode, Contract, extend } from '../index.mjs';

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

        nodeAssert.ok(stackContract.assertions.pop);
        nodeAssert.ok(stackContract.assertions.push);
        // @ts-expect-error
        nodeAssert.ok(stackContract.assertions.foo);
    });

    test('Specify \'demands\' assertion on features', () => {
        let stackContract = new Contract<StackType<any>>({
            pop: {
                demands: undefined
            }
        });
        nodeAssert.ok(stackContract.assertions.pop!.demands instanceof Function);

        stackContract = new Contract<StackType<any>>({
            pop: {
                demands() { return true; }
            }
        });
        nodeAssert.ok(stackContract.assertions.pop!.demands instanceof Function);
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
        nodeAssert.ok(stackContract.assertions.pop!.ensures instanceof Function);

        stackContract = new Contract<StackType<any>>({
            pop: {
                ensures() { return true; }
            }
        });

        nodeAssert.ok(stackContract.assertions.pop!.ensures instanceof Function);
    });

    test('Specify a "rescue" on features', () => {
        let stackContract = new Contract<StackType<any>>({
            push: {
                rescue: undefined
            }
        });
        nodeAssert.strictEqual(stackContract.assertions.pop?.rescue, undefined);

        stackContract = new Contract<StackType<any>>({
            push: {
                rescue(_self, _error, _args, _retry) { }
            },
            pop: {
                // @ts-expect-error
                rescue: false
            }
        });
        nodeAssert.ok(stackContract.assertions.push?.rescue instanceof Function);
    });

    // https://github.com/final-hill/decorator-contracts/issues/179
    test('Specify a \'checkedMode\' declaration', () => {
        const stackContract = new Contract<StackType<any>>({
            [checkedMode]: true
        });

        nodeAssert.ok(stackContract[checkedMode]);
    });

    test('Specify an \'extend\' declaration', () => {
        const stackContract = new Contract<StackType<any>>({
            [checkedMode]: true
        }),
            subContract = new Contract<StackType<any>>({
                [extend]: stackContract
            });

        nodeAssert.ok(subContract[extend]);
    });
});

// https://github.com/final-hill/decorator-contracts/issues/181
describe('Only a single contract can be assigned to a class', () => {
    test('Good declaration', () => {
        nodeAssert.doesNotThrow(() => {
            const fooContract = new Contract<Foo>(),
                barContract = new Contract<Bar>({
                    [extend]: fooContract
                });

            @Contracted(fooContract)
            class Foo { }

            @Contracted(barContract)
            class Bar extends Foo { }

            return new Bar();
        });
    });

    test('Bad Declaration', () => {
        nodeAssert.throws(() => {
            const fooContract = new Contract(),
                barContract = new Contract();
            @Contracted(fooContract)
            @Contracted(barContract)
            class Foo { }

            return new Foo();
        }, { message: Messages.MsgSingleContract });
    });
});

// https://github.com/final-hill/decorator-contracts/issues/193
describe('An abstract class must support contract declarations', () => {
    test('Concrete declaration', () => {
        nodeAssert.doesNotThrow(() => {
            const baseContract = new Contract<Base>({});
            @Contracted(baseContract)
            class Base { }

            return Base;
        });
    });

    test('Abstract declaration', () => {
        nodeAssert.doesNotThrow(() => {
            const baseContract = new Contract<Base>({});
            @Contracted(baseContract)
            abstract class Base { }

            return Base;
        });
    });
});

// https://github.com/final-hill/decorator-contracts/issues/187
describe('A subclass can only be contracted by a subcontract of the base class contract', () => {
    test('Good', () => {
        nodeAssert.doesNotThrow(() => {
            const fooContract = new Contract<Foo>({});

            @Contracted(fooContract)
            class Foo { }

            const barContract = new Contract<Bar>({
                [extend]: fooContract
            });

            @Contracted(barContract)
            class Bar { }

            return Bar;
        });
    });

    test('Bad - missing extends', () => {
        const fooContract = new Contract<Foo>({});

        @Contracted(fooContract)
        class Foo { }

        nodeAssert.throws(() => {
            const badContract = new Contract<Bar>({});
            @Contracted(badContract)
            class Bar extends Foo { }
        }, { message: Messages.MsgBadSubcontract });
    });
});