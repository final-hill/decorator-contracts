/*!
 * @license
 * Copyright (C) 2022 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { AssertionError, checkedMode, Contract, Contracted, extend, override } from '../';

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
            #value = 0;

            get value(): number { return this.#value; }
            set value(value: number) { this.#value = value; }

            inc(): void { this.value += 2; }
            dec(): void { this.value -= 1; }
        }

        const foo = new Foo();

        expect(() => foo.inc()).not.toThrow();

        expect(foo.value).toBe(2);

        expect(() => {
            foo.dec();
            foo.dec();
        }).toThrow(AssertionError);
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
        #value = 0;

        get value(): number { return this.#value; }
        set value(value: number){ this.#value = value; }

        dec(): void { this.value--; }
        inc(): void { this.value++; }
    }

    class Sub extends Base {
        @override
        override dec(): void { this.value -= 2; }
    }

    test('inc(); inc(); dec(); does not throw', () => {
        expect(() => {
            const sub = new Sub();
            sub.inc();
            sub.inc();
            sub.dec();
        }).not.toThrow();
    });

    test('dec(); dec(); throws', () => {
        expect(() => {
            const sub = new Sub();
            sub.dec();
            sub.dec();
        }).toThrow(AssertionError);
    });

    class SubSub extends Sub {
        @override
        override dec(): void { this.value -= 4; }
    }

    test('inc(); inc(); inc(); inc(): dec(); does not throw', () => {
        expect(() => {
            const subSub = new SubSub();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.dec();
        }).not.toThrow();
    });

    test('inc(); inc(); inc(); inc(): dec(); dec(); dec(); throws', () => {
        expect(() => {
            const subSub = new SubSub();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.dec();
            subSub.dec();
            subSub.dec();
        }).toThrow(AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/73
 */
describe('The `demands` assertion is evaluated before its associated feature is called', () => {
    class Foo {
        #value = 0;

        get value(): number { return this.#value; }
        set value(value: number){ this.#value = value; }
    }

    test('true "demands" check does not throw', () => {
        const barContract = new Contract<Bar>({
            method: {
                demands(self){ return self.value >= 0; }
            }
        });

        @Contracted(barContract)
        class Bar extends Foo {
            method(): number {
                return this.value = -2;
            }
        }

        const bar = new Bar();

        expect(bar.method()).toBe(-2);
    });

    test('false "demands" check throws', () => {
        const barContract = new Contract<Bar>({
            method: {
                demands(){ return false; }
            }
        });

        @Contracted(barContract)
        class Bar extends Foo {
            method(): number {
                return this.value = 12;
            }
        }

        const bar = new Bar();

        expect(() => bar.method()).toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/74
 */
describe('`demands` assertions are enabled in `checkedMode` and disabled otherwise', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        const fooContract = new Contract<Foo>({
            method: {
                demands(){ return false; }
            }
        });

        @Contracted(fooContract)
        class Foo {
            method(): void {}
        }

        expect(() => new Foo().method()).toThrow();
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        const fooContract = new Contract<Foo>({
            [checkedMode]: false,
            method: {
                demands(){ return false; }
            }
        });

        @Contracted(fooContract)
        class Foo {
            method(): void {}
        }

        expect(() => new Foo().method()).not.toThrow();
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

        expect(base.method(15)).toBe(15);
        expect(() => base.method(5)).toThrow(AssertionError);
        expect(() => base.method(35)).toThrow(AssertionError);
    });

    const weakerContract = new Contract<Weaker>({
        [extend]: baseContract,
        method: {
            demands(_, value: number) { return 1 <= value && value <= 50; }
        }
    });

    @Contracted(weakerContract)
    class Weaker extends Base {
        @override
        override method(value: number): number { return value; }
    }

    test('Weaker precondition', () => {
        const weaker = new Weaker();

        expect(weaker.method(15)).toBe(15);
        expect(weaker.method(5)).toBe(5);
        expect(weaker.method(35)).toBe(35);
        expect(() => weaker.method(0)).toThrow(AssertionError);
        expect(() => weaker.method(60)).toThrow(AssertionError);
    });

    const strongerContract = new Contract<Stronger>({
        [extend]: baseContract,
        method: {
            demands(_, value){ return 15 <= value && value <= 20; }
        }
    });

    @Contracted(strongerContract)
    class Stronger extends Base {
        @override
        override method(value: number): number { return value; }
    }

    test('Stronger precondition', () => {
        const stronger = new Stronger();

        expect(stronger.method(15)).toBe(15);
        expect(() => stronger.method(5)).toThrow(AssertionError);
        expect(() => stronger.method(35)).toThrow(AssertionError);
        expect(stronger.method(25)).toBe(25);
    });
});