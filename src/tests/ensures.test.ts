/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { AssertionError, checkedMode, Contract, Contracted, extend, override } from '../';

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
        }).toThrow(AssertionError);
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
        #value = 0;

        get value(): number { return this.#value; }
        set value(value: number){ this.#value = value; }

        dec(): void { this.value--; }
        inc(): void { this.value++; }
    }

    class Sub extends Base {
        @override
        dec(): void { this.value -= 2; }
    }

    test('inc(); inc(); dec(); does not throw', () => {
        expect(() => {
            const sub = new Sub();
            sub.inc();
            sub.inc();
            sub.dec();
        }).not.toThrow();
    });

    test('dec(); throws', () => {
        expect(() => {
            const sub = new Sub();
            sub.dec();
        }).toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/80
 */
describe('The ensures assertion is evaluated after its associated feature is called', () => {
    class Foo {
        #value = 0;

        get value(): number { return this.#value; }
        set value(value: number) { this.#value = value; }
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

        expect(bar.method()).toBe(2);
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

        expect(() => { bar.method(); }).toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/81
 */
describe('`ensures` assertions are enabled in checkedMode and disabled otherwise', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        const fooContract = new Contract<Foo>({
            method: {
                ensures(){ return false; }
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
                ensures(){ return false; }
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
 * https://github.com/final-hill/decorator-contracts/issues/82
 */
describe('Postconditions cannot be weakened in a subtype', () => {
    const baseContract = new Contract<Base>({
        method: {
            ensures(_self, _old, value){ return 10 <= value && value <= 30; }
        }
    });

    @Contracted(baseContract)
    class Base {
        method(value: number): number { return value; }
    }

    test('Base postcondition', () => {
        const base = new Base();

        expect(base.method(15)).toBe(15);
        expect(base.method(25)).toBe(25);
        expect(() => base.method(5)).toThrow(AssertionError);
        expect(() => base.method(35)).toThrow(AssertionError);
    });

    const weakerContract = new Contract<Weaker>({
        [extend]: baseContract,
        method: {
            ensures(_self, _old, value: number) { return 1 <= value && value <= 50; }
        }
    });

    @Contracted(weakerContract)
    class Weaker extends Base {
        @override
        method(value: number): number { return value; }
    }

    test('Weaker postcondition', () => {
        const weaker = new Weaker();

        expect(weaker.method(15)).toBe(15);
        expect(weaker.method(25)).toBe(25);
        expect(() => weaker.method(5)).toThrow(AssertionError);
        expect(() => weaker.method(35)).toThrow(AssertionError);
    });

    const strongerContract = new Contract<Stronger>({
        [extend]: baseContract,
        method: {
            ensures(_self, _old, value: number){ return 15 <= value && value <= 20; }
        }
    });

    @Contracted(strongerContract)
    class Stronger extends Base {
        @override
        method(value: number): number { return value; }
    }

    test('Stronger postcondition', () => {
        const stronger = new Stronger();

        expect(stronger.method(15)).toBe(15);
        expect(stronger.method(20)).toBe(20);
        expect(() => stronger.method(25)).toThrow(AssertionError);
        expect(() => stronger.method(5)).toThrow(AssertionError);
        expect(() => stronger.method(35)).toThrow(AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/98
 */
 describe('ensures has access to the properties of the instance class before its associated member was executed', () => {
    test('Stack Size', () => {
        const stackContract = new Contract<Stack<any>>({
            pop: {
                ensures(self,old){ return self.size == old.size - 1; }
            },
            push: {
                ensures(self, old) { return self.size == old.size + 1; }
            }
        });

        @Contracted(stackContract)
        class Stack<T> {
            #implementation: T[] = [];
            #size = 0;

            get size(){ return this.#size; }

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

        expect(stack.size).toEqual(0);
        expect(() => {
            stack.push('a');
            stack.push('b');
            stack.push('c');
        }).not.toThrow();
        expect(() => stack.pop()).not.toThrow();
        expect(stack.size).toEqual(2);
    });
});