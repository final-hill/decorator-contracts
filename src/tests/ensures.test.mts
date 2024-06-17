/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { AssertionError, checkedMode, Contract, Contracted, extend } from '../index.mjs';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

/**
 * https://github.com/final-hill/decorator-contracts/issues/78
 */
describe('Ensures assertions can be defined for a class feature', () => {
    test('Basic Definition', () => {
        const nonNegative = (self: Foo): boolean => self.value >= 0,
            isEven = (self: Foo): boolean => self.value % 2 == 0,
            fooContract = new Contract<Foo>({
                dec: {
                    ensures(self) { return nonNegative(self) && isEven(self); }
                },
                inc: {
                    ensures(self) { return nonNegative(self) && isEven(self); }
                }
            });


        @Contracted(fooContract)
        class Foo {
            accessor value = 0;

            inc(): void { this.value += 2; }
            dec(): void { this.value -= 1; }
        }

        const foo = new Foo();

        nodeAssert.doesNotThrow(() => foo.inc());

        nodeAssert.strictEqual(foo.value, 2);

        nodeAssert.throws(() => {
            foo.dec();
        }, AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/79
 */
describe('Overridden features are still subject to the ensures assertion ', () => {
    const baseContract = new Contract<Base>({
        dec: {
            ensures(self) { return self.value >= 0; }
        }
    });

    @Contracted(baseContract)
    class Base {
        accessor value = 0;

        dec(): void { this.value--; }
        inc(): void { this.value++; }
    }

    class Sub extends Base {
        override dec(): void { this.value -= 2; }
    }

    test('inc(); inc(); dec(); does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const sub = new Sub();
            sub.inc();
            sub.inc();
            sub.dec();
        });
    });

    test('dec(); throws', () => {
        nodeAssert.throws(() => {
            const sub = new Sub();
            sub.dec();
        });
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/80
 */
describe('The ensures assertion is evaluated after its associated feature is called', () => {
    class Foo {
        accessor value = 0;
    }

    test('true @ensures check does not throw', () => {
        const barContract = new Contract<Bar>({
            method: {
                ensures(self) { return self.value >= 0; }
            }
        });

        @Contracted(barContract)
        class Bar extends Foo {
            method(): number { return this.value = 2; }
        }

        const bar = new Bar();

        nodeAssert.strictEqual(bar.method(), 2);
    });

    test('false @ensures check throws', () => {
        const barContract = new Contract<Bar>({
            method: {
                ensures() { return false; }
            }
        });

        @Contracted(barContract)
        class Bar extends Foo {
            method(): number { return this.value = 12; }
        }
        const bar = new Bar();

        nodeAssert.throws(() => { bar.method(); });
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/81
 */
describe('`ensures` assertions are enabled in checkedMode and disabled otherwise', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        const fooContract = new Contract<Foo>({
            method: {
                ensures() { return false; }
            }
        });

        @Contracted(fooContract)
        class Foo {
            method(): void { }
        }

        nodeAssert.throws(() => new Foo().method());
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        const fooContract = new Contract<Foo>({
            [checkedMode]: false,
            method: {
                ensures() { return false; }
            }
        });

        @Contracted(fooContract)
        class Foo {
            method(): void { }
        }

        nodeAssert.doesNotThrow(() => new Foo().method());
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/82
 */
describe('Postconditions cannot be weakened in a subtype', () => {
    const baseContract = new Contract<Base>({
        method: {
            ensures(_self, _old, value) { return 10 <= value && value <= 30; }
        }
    });

    @Contracted(baseContract)
    class Base {
        method(value: number): number { return value; }
    }

    test('Base postcondition', () => {
        const base = new Base();

        nodeAssert.strictEqual(base.method(15), 15);
        nodeAssert.strictEqual(base.method(25), 25);
        nodeAssert.throws(() => base.method(5), AssertionError);
        nodeAssert.throws(() => base.method(35), AssertionError);
    });

    const weakerContract = new Contract<Weaker>({
        [extend]: baseContract,
        method: {
            ensures(_self, _old, value: number) { return 1 <= value && value <= 50; }
        }
    });

    @Contracted(weakerContract)
    class Weaker extends Base {
        override method(value: number): number { return value; }
    }

    test('Weaker postcondition', () => {
        const weaker = new Weaker();

        nodeAssert.strictEqual(weaker.method(15), 15);
        nodeAssert.strictEqual(weaker.method(25), 25);
        nodeAssert.throws(() => weaker.method(5), AssertionError);
        nodeAssert.throws(() => weaker.method(35), AssertionError);
    });

    const strongerContract = new Contract<Stronger>({
        [extend]: baseContract,
        method: {
            ensures(_self, _old, value: number) { return 15 <= value && value <= 20; }
        }
    });

    @Contracted(strongerContract)
    class Stronger extends Base {
        override method(value: number): number { return value; }
    }

    test('Stronger postcondition', () => {
        const stronger = new Stronger();

        nodeAssert.strictEqual(stronger.method(15), 15);
        nodeAssert.strictEqual(stronger.method(20), 20);
        nodeAssert.throws(() => stronger.method(25), AssertionError);
        nodeAssert.throws(() => stronger.method(5), AssertionError);
        nodeAssert.throws(() => stronger.method(35), AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/98
 */
describe('ensures has access to the properties of the instance class before its associated member was executed', () => {
    test('Stack Size', () => {
        const stackContract = new Contract<Stack<any>>({
            pop: {
                ensures(self, old) { return self.size == old.size - 1; }
            },
            push: {
                ensures(self, old) { return self.size == old.size + 1; }
            }
        });

        @Contracted(stackContract)
        class Stack<T> {
            #implementation: T[] = [];
            #size = 0;

            get size() { return this.#size; }

            pop(): T {
                const result = this.#implementation.pop()!;
                this.#size = this.#implementation.length;

                return result;
            }

            push(item: T): void {
                this.#implementation.push(item);
                this.#size = this.#implementation.length;
            }
        }

        const stack = new Stack<string>();

        nodeAssert.strictEqual(stack.size, 0);
        nodeAssert.doesNotThrow(() => {
            stack.push('a');
            stack.push('b');
            stack.push('c');
        });
        nodeAssert.doesNotThrow(() => stack.pop());
        nodeAssert.strictEqual(stack.size, 2);
    });
});