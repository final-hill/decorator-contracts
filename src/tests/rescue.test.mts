/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Messages } from '../Messages.mjs';
import { checkedMode, Contract, Contracted, invariant } from '../index.mjs';

/**
 * https://github.com/final-hill/decorator-contracts/issues/58
 */
describe('The `rescue` declaration must preserve the invariant after execution', () => {
    const baseContract = new Contract<Base>({
        [invariant](self) { return self.value > 0; },
        method1: {
            rescue(self) { self.value = 5; }
        },
        method2: {
            rescue(self) { self.value = -1; }
        }
    });

    @Contracted(baseContract)
    class Base {
        accessor value = 3;

        method1(): void { throw new Error('I am error'); }
        method2(): void { throw new Error('I am error'); }
    }

    test('test', () => {
        const base = new Base();
        nodeAssert.throws(() => base.method1(), 'I am error');
        nodeAssert.strictEqual(base.value, 5);
        nodeAssert.throws(() => {
            base.method2();
        }, /^Invariant violated/);
        nodeAssert.throws(() => base.value, /^Invariant violated/);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/59
 */
describe('Any error thrown by a class feature must be captured by its @rescue', () => {
    test('rescuing non-error method returns normal', () => {
        const baseContract = new Contract<Base>({
            method: {
                rescue() { }
            }
        });

        @Contracted(baseContract)
        class Base {
            method(): number { return 7; }
        }
        const base = new Base();

        nodeAssert.strictEqual(base.method(), 7);
    });

    test('rescue of method with an error then retrying returns ok', () => {
        const baseContract = new Contract<Base>({
            method: {
                rescue(_self, _error: any, _args: any[], retry: any) { retry(3); }
            }
        });

        @Contracted(baseContract)
        class Base {
            method(value: number): number {
                if (value <= 0)
                    throw new Error('value must be greater than 0');
                else
                    return value;
            }
        }
        const base = new Base();
        nodeAssert.strictEqual(base.method(0), 3);
    });

    test('rescue of method with an error then rethrow throws to caller', () => {
        const baseContract = new Contract<Base>({
            method: {
                rescue() { throw new Error('Rescue throw'); }
            }
        });

        @Contracted(baseContract)
        class Base {
            method(): void {
                throw new Error('Method error');
            }
        }
        const base = new Base();
        try {
            base.method();
            nodeAssert.fail('Expected an error to be thrown');
        } catch (error: any) {
            nodeAssert.strictEqual(error.message, 'Rescue throw');
        }
    });

    test('rescuing non-error getter returns normal', () => {
        const baseContract = new Contract<Base>({
            value: { rescue() { } }
        });

        @Contracted(baseContract)
        class Base {
            get value(): number { return 7; }
        }
        const base = new Base();
        nodeAssert.strictEqual(base.value, 7);
    });

    test('rescuing error getter then retry returns ok', () => {
        const baseContract = new Contract<Base>({
            value: {
                rescue(self, _error, _args, retry) {
                    self.value = 7;
                    retry(7);
                }
            }
        });

        @Contracted(baseContract)
        class Base {
            #value = 0;

            get value(): number {
                if (this.#value == 0)
                    throw new Error('Bad State');
                else
                    return this.#value;
            }
            set value(v: number) {
                this.#value = v;
            }
        }
        const base = new Base();
        nodeAssert.strictEqual(base.value, 7);
    });

    test('rescue of error getter then rethrow throws to caller', () => {
        const baseContract = new Contract<Base>({
            value: {
                rescue() { throw new Error('Not Rescued'); }
            }
        });

        @Contracted(baseContract)
        class Base {
            get value(): void {
                throw new Error('Not implemented');
            }
        }
        const base = new Base();
        try {
            const value = base.value;
            nodeAssert.fail(`Expected an error to be thrown when getting value${value}`);
        } catch (error: any) {
            nodeAssert.strictEqual(error.message, 'Not Rescued');
        }
    });

    test('rescuing non-error setter then getting returns normal', () => {
        const baseContract = new Contract<Base>({
            value: {
                rescue() { }
            }
        });

        @Contracted(baseContract)
        class Base {
            accessor value = NaN;
        }
        const base = new Base();
        base.value = 12;
        nodeAssert.strictEqual(base.value, 12);
    });

    test('rescue of error setter then retry then getting returns ok', () => {
        const baseContract = new Contract<Base>({
            value: {
                rescue(_self, _error, _args, retry) {
                    retry(0);
                }
            }
        });

        @Contracted(baseContract)
        class Base {
            #value = NaN;

            get value(): number { return this.#value; }
            set value(value: number) {
                if (Number.isNaN(value))
                    throw new Error('NaN not allowed');

                this.#value = value;
            }
        }
        const base = new Base();
        base.value = NaN;
        nodeAssert.strictEqual(base.value, 0);
    });

    test('rescue of error setter then rethrow throws error at caller', () => {
        const baseContract = new Contract<Base>({
            value: {
                rescue() { throw new Error('Rescue fail'); }
            }
        });

        @Contracted(baseContract)
        class Base {
            #value = NaN;

            get value(): number { return this.#value; }
            set value(_: number) { throw new Error('Setter fail'); }
        }
        const base = new Base();
        nodeAssert.throws(() => base.value = 12, 'Rescue fail');
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/60
 */
describe('The rescue declarations are enabled in checkedMode and disabled otherwise', () => {
    test('enabled', () => {
        nodeAssert.throws(() => {
            const baseContract = new Contract<Base>({
                throws: {
                    rescue() { throw new Error('I am still an Error'); }
                }
            });

            @Contracted(baseContract)
            class Base {
                throws(value: string): void {
                    throw new Error(value);
                }
            }

            const base = new Base();
            base.throws('I am Error');
        }, 'I am still an Error');
    });

    test('disabled', () => {
        nodeAssert.throws(() => {
            const baseContract = new Contract<Base>({
                [checkedMode]: false,
                throws: {
                    rescue() { throw new Error('I am still an Error'); }
                }
            });

            @Contracted(baseContract)
            class Base {
                throws(value: string): void {
                    throw new Error(value);
                }
            }

            const base = new Base();
            base.throws('I am Error');
        }, 'I am Error');
    });
});

// https://github.com/final-hill/decorator-contracts/issues/62
describe('The `retry` argument of the `rescue` declaration can only be called once during rescue execution', () => {
    test('rescue of method with an error then retrying returns ok', () => {
        const baseContract = new Contract<Base>({
            method: {
                rescue(_self, _error: any, _args: any[], retry: any) { retry(3); }
            }
        });

        @Contracted(baseContract)
        class Base {
            method(value: number): number {
                if (value <= 0)
                    throw new Error('value must be greater than 0');
                else
                    return value;
            }
        }
        const base = new Base();
        nodeAssert.strictEqual(base.method(0), 3);
    });

    test('rescue of method with an error then retrying twice throws', () => {
        const baseContract = new Contract<Base>({
            method: {
                rescue(_self, _error: any, _args: any[], retry: any) {
                    retry(3);
                    retry(3);
                }
            }
        });

        @Contracted(baseContract)
        class Base {
            method(value: number): number {
                if (value <= 0)
                    throw new Error('value must be greater than 0');
                else
                    return value;
            }
        }
        const base = new Base();
        try {
            base.method(0);
            nodeAssert.fail('Expected an error to be thrown');
        } catch (error: any) {
            nodeAssert.strictEqual(error.message, Messages.MsgSingleRetry);
        }
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/63
 */
describe('If a `rescue` is executed and the `retry` argument is not called then the original error is thrown', () => {
    const baseContract = new Contract<Base>({
        throwRescue: {
            rescue(_self, _error, _args, retry) {
                retry(false);
            }
        },
        throwFail: {
            rescue() { /* Do nothing */ }
        }
    });

    @Contracted(baseContract)
    class Base {
        throwRescue(trigger: boolean): boolean {
            if (trigger)
                throw new Error('I am error');
            else
                return true;
        }
        throwFail(): void {
            throw new Error('I am error');
        }
    }

    const base = new Base();

    test('Rescued error', () => {
        nodeAssert.strictEqual(base.throwRescue(true), true);
    });

    test('Un-rescued error', () => {
        nodeAssert.throws(() => base.throwFail(), 'I am error');
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/64
 */
describe('If an exception is thrown in a class feature without a `rescue` defined then the exception is raised to its caller after the `invariant` is checked', () => {
    const contractA = new Contract<A>({
        method: {}
    });

    @Contracted(contractA)
    class A {
        method(): void {
            throw new Error('I am error');
        }
    }

    test('Throwing error without `invariant` is raised to caller', () => {
        nodeAssert.throws(() => new A().method(), { message: 'I am error' });
    });

    const contractB = new Contract<B>({
        [invariant](self) { return self.value > 0; }
    });

    @Contracted(contractB)
    class B {
        accessor value = 1;

        method1(): void {
            this.value = 3;
            throw new Error('I am error');
        }

        method2(): void {
            this.value = -2;
            throw new Error('I am error');
        }
    }

    test('Throwing error with `invariant`', () => {
        nodeAssert.throws(() => new B().method1(), { message: 'I am error' });
        nodeAssert.throws(() => {
            new B().method2();
        }, /^Invariant violated/);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/65
 */
describe('If an error is thrown in `demands` the error is raised to the caller', () => {
    const contractA = new Contract<A>({
        [invariant](self) { return self.value > 0; },
        method: {
            rescue(_self, _error, args, _retry) {
                if (args[0] === -2) throw new Error('Rescue Error');
            },
            demands(_self, value) { return value >= 0; }
        },
        methodEmpty: {
            demands() { return false; },
            rescue() { throw new Error('Rescue Error'); }
        },
        methodError: {
            demands() { return true; },
            rescue() { throw new Error('Rescue Error'); }
        }
    });

    @Contracted(contractA)
    class A {
        accessor value = 1;

        method(value: number): void { this.value = value; }
        methodEmpty(): void { }
        methodError(): void { throw new Error('Feature Error'); }
    }

    test('Error pathways', () => {
        nodeAssert.doesNotThrow(() => new A().method(1));
        nodeAssert.throws(() => new A().method(0), /^Invariant violated/);
        nodeAssert.throws(() => new A().method(-1), /^demands not met/);
        nodeAssert.doesNotThrow(() => new A().method(-2), /^Rescue Error/);

        nodeAssert.throws(() => new A().methodEmpty(), /^demands not met/);
        nodeAssert.throws(() => new A().methodError(), /^Rescue Error/);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/66
 */
describe('If an error is raised in an `ensures` then the associated rescue is executed', () => {
    const contractA = new Contract<A>({
        [invariant](self) { return self.value >= 0; },
        method: {
            ensures(self) { return self.value > 0; },
            rescue(_self, _error, args, _retry) {
                if (args[0] === -2) throw new Error('Rescue Error');
            }
        },
        methodEmpty: {
            ensures() { return false; }
        },
        methodError: {
            ensures() { return true; },
            rescue() { throw new Error('Rescue Error'); }
        }
    });

    @Contracted(contractA)
    class A {
        accessor value = 1;

        method(value: number): void { this.value = value; }
        methodEmpty(): void { }
        methodError(): void { throw new Error('Feature Error'); }
    }

    test('Error pathways', () => {
        nodeAssert.doesNotThrow(() => new A().method(1));
        nodeAssert.throws(() => new A().method(0), /^ensures not met/);
        nodeAssert.throws(() => new A().method(-1), /^Invariant violated/);
        nodeAssert.doesNotThrow(() => new A().method(-2), /^Rescue Error/);
        nodeAssert.throws(() => new A().methodEmpty(), /^ensures not met/);
        nodeAssert.throws(() => new A().methodError(), /^Rescue Error/);
    });
});