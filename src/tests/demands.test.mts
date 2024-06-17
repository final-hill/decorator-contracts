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
 * https://github.com/final-hill/decorator-contracts/issues/70
 */
describe('Demands assertions can be defined for a class feature', () => {
    test('Basic definition', () => {
        const nonNegative = (self: Foo): boolean => self.value >= 0,
            isEven = (self: Foo): boolean => self.value % 2 == 0,
            fooContract = new Contract<Foo>({
                inc: {
                    demands(self) {
                        return nonNegative(self) && isEven(self);
                    }
                },
                dec: {
                    demands(self) {
                        return nonNegative(self) && isEven(self);
                    }
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
            foo.dec();
        }, AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/71
 */
describe('Overridden features are still subject to the demands assertion', () => {
    const baseContract = new Contract<Base>({
        dec: {
            demands(self) { return self.value >= 0; }
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

    test('dec(); dec(); throws', () => {
        nodeAssert.throws(() => {
            const sub = new Sub();
            sub.dec();
            sub.dec();
        }, AssertionError);
    });

    class SubSub extends Sub {
        override dec(): void { this.value -= 4; }
    }

    test('inc(); inc(); inc(); inc(): dec(); does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const subSub = new SubSub();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.dec();
        });
    });

    test('inc(); inc(); inc(); inc(): dec(); dec(); dec(); throws', () => {
        nodeAssert.throws(() => {
            const subSub = new SubSub();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.dec();
            subSub.dec();
            subSub.dec();
        }, AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/73
 */
describe('The `demands` assertion is evaluated before its associated feature is called', () => {
    class Foo {
        accessor value = 0;
    }

    test('true "demands" check does not throw', () => {
        const barContract = new Contract<Bar>({
            method: {
                demands(self) { return self.value >= 0; }
            }
        });

        @Contracted(barContract)
        class Bar extends Foo {
            method(): number {
                return this.value = -2;
            }
        }

        const bar = new Bar();

        nodeAssert.strictEqual(bar.method(), -2);
    });

    test('false "demands" check throws', () => {
        const barContract = new Contract<Bar>({
            method: {
                demands() { return false; }
            }
        });

        @Contracted(barContract)
        class Bar extends Foo {
            method(): number {
                return this.value = 12;
            }
        }

        const bar = new Bar();

        nodeAssert.throws(() => bar.method());
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/74
 */
describe('`demands` assertions are enabled in `checkedMode` and disabled otherwise', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        const fooContract = new Contract<Foo>({
            method: {
                demands() { return false; }
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
                demands() { return false; }
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
 * https://github.com/final-hill/decorator-contracts/issues/75
 */
describe('`demands` assertions cannot be strengthened in a subtype', () => {
    const baseContract = new Contract<Base>({
        method: {
            demands(_self, value: number) { return 10 <= value && value <= 30; }
        }
    });

    @Contracted(baseContract)
    class Base {
        method(value: number): number { return value; }
    }

    test('Base demands', () => {
        const base = new Base();

        nodeAssert.strictEqual(base.method(15), 15);
        nodeAssert.throws(() => base.method(5), AssertionError);
        nodeAssert.throws(() => base.method(35), AssertionError);
    });

    const weakerContract = new Contract<Weaker>({
        [extend]: baseContract,
        method: {
            demands(_, value: number) { return 1 <= value && value <= 50; }
        }
    });

    @Contracted(weakerContract)
    class Weaker extends Base {
        override method(value: number): number { return value; }
    }

    test('Weaker precondition', () => {
        const weaker = new Weaker();

        nodeAssert.strictEqual(weaker.method(15), 15);
        nodeAssert.strictEqual(weaker.method(5), 5);
        nodeAssert.strictEqual(weaker.method(35), 35);
        nodeAssert.throws(() => weaker.method(0), AssertionError);
        nodeAssert.throws(() => weaker.method(60), AssertionError);
    });

    const strongerContract = new Contract<Stronger>({
        [extend]: baseContract,
        method: {
            demands(_, value) { return 15 <= value && value <= 20; }
        }
    });

    @Contracted(strongerContract)
    class Stronger extends Base {
        override method(value: number): number { return value; }
    }

    test('Stronger precondition', () => {
        const stronger = new Stronger();

        nodeAssert.strictEqual(stronger.method(15), 15);
        nodeAssert.throws(() => stronger.method(5), AssertionError);
        nodeAssert.throws(() => stronger.method(35), AssertionError);
        nodeAssert.strictEqual(stronger.method(25), 25);
    });
});