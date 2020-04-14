/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

/* eslint "require-jsdoc": "off" */

import Contracts from './';
import { MSG_DUPLICATE_RESCUE } from './RescueDecorator';
import { MSG_INVARIANT_REQUIRED, MSG_SINGLE_RETRY } from './MemberDecorator';

/**
 * Requirement 400
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/400
 */
describe('Any error thrown by a class feature must be captured by its @rescue', () => {
    const {invariant, rescue} = new Contracts(true);

    test('rescuing non-error method returns normal', () => {
        @invariant
        class Base {
            @rescue(() => {})
            method(): number { return 7; }
        }
        const base = new Base();

        expect(base.method()).toBe(7);
    });

    test('rescue of method with an error then retrying returns ok', () => {
        @invariant
        class Base {
            @rescue((_error: any, _args: any[], retry: any) => retry(3))
            method(value: number): number {
                if(value <= 0) {
                    throw new Error('value must be greater than 0');
                } else {
                    return value;
                }
            }
        }
        const base = new Base();
        expect(base.method(0)).toBe(3);
    });

    test('rescue of method with an error then rethrow throws to caller', () => {
        @invariant
        class Base {
            @rescue(() => { throw new Error('Rescue throw'); })
            method(): void {
                throw new Error('Method error');
            }
        }
        const base = new Base();
        expect(() => base.method()).toThrow('Rescue throw');
    });

    test('rescuing non-error getter returns normal', () => {
        @invariant
        class Base {
            @rescue(() => {})
            get value(): number { return 7; }
        }
        const base = new Base();
        expect(base.value).toBe(7);
    });

    test('rescuing error getter then retry returns ok', () => {
        @invariant
        class Base {
            #value = 0;

            @rescue(function(this: Base, _error: any, _args: any[], retry: Function) {
                this.value = 7;
                retry();
            })
            get value(): number {
                if(this.#value == 0) {
                    throw new Error('Bad State');
                } else {
                    return this.#value;
                }
            }
            set value(v: number) {
                this.#value = v;
            }
        }
        const base = new Base();
        expect(base.value).toBe(7);
    });

    test('rescue of error getter then rethrow throws to caller', () => {
        @invariant
        class Base {
            @rescue(() => {
                throw new Error('Not Rescued');
            })
            get value(): void {
                throw new Error('Not implemented');
            }
        }
        const base = new Base();
        expect(() => base.value).toThrow('Not Rescued');
    });

    test('rescuing non-error setter then getting returns normal', () => {
        @invariant
        class Base {
            #value = NaN;

            get value(): number { return this.#value; }
            @rescue(() => {})
            set value(value: number) { this.#value = value; }
        }
        const base = new Base();
        base.value = 12;
        expect(base.value).toBe(12);
    });

    test('rescue of error setter then retry then getting returns ok', () => {
        @invariant
        class Base {
            #value = NaN;

            get value(): number { return this.#value; }

            @rescue((_error: any, _args: any[], retry: Function) => {
                retry(0);
            })
            set value(value: number) {
                if(Number.isNaN(value)) {
                    throw new Error('NaN not allowed');
                }
                this.#value = value;
            }
        }
        const base = new Base();
        base.value = NaN;
        expect(base.value).toBe(0);
    });

    test('rescue of error setter then rethrow throws error at caller', () => {
        @invariant
        class Base {
            #value = NaN;

            get value(): number { return this.#value; }
            @rescue(() => { throw new Error('Rescue fail'); })
            set value(_: number) { throw new Error('Setter fail'); }
        }
        const base = new Base();
        expect(() => base.value = 12).toThrow('Rescue fail');
    });
});

/**
 * Requirement 434
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/434
 */
describe('The @rescue constructor has a checked mode that enables its execution', () => {
    test('enabled', () => {
        const {invariant, rescue} = new Contracts(true);

        /**
         * Throws arbitrary error
         */
        function baseRescue(): void {
            throw new Error('I am still an Error');
        }

        expect(() => {
            @invariant
            class Base {
                @rescue(baseRescue)
                throws(value: string): void {
                    throw new Error(value);
                }
            }

            const base = new Base();
            base.throws('I am Error');
        }).toThrow('I am still an Error');
    });

    test('disabled', () => {
        const {invariant, rescue} = new Contracts(false);

        expect(() => {
            @invariant
            class Base {
                @rescue(() => {
                    throw new Error('I am still an Error');
                })
                throws(value: string): void {
                    throw new Error(value);
                }
            }

            const base = new Base();
            base.throws('I am Error');
        }).toThrow('I am Error');
    });
});

/**
 * Requirement 455
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/455
 */
describe('Only a single @rescue can be assigned to a method or accessor', () => {
    const {invariant, rescue} = new Contracts(true);

    test('Single rescue ok', () => {
        expect(() => {
            @invariant
            class Base {
                @rescue(() => {})
                method(): void {}
            }

            return Base;
        }).not.toThrow();
    });

    test('Multiple rescue throws', () => {
        expect(() => {
            @invariant
            class Base {
                @rescue(() => {})
                @rescue(() => {})
                method(): void {}
            }

            return Base;
        }).toThrow(MSG_DUPLICATE_RESCUE);
    });
});

/**
 * Requirement 456
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/456
 */
describe('The \'retry\' argument of the @rescue function can only be called once during rescue execution', () => {
    const {invariant, rescue} = new Contracts(true);

    test('Call retry once succeeds', () => {
        function methodRescue(_error: any, _args: any[], retry: any): void {
            retry(3);
        }

        @invariant
        class Base {
            @rescue(methodRescue)
            method(value: number): number {
                if(value <= 0) {
                    throw new Error('value must be greater than 0');
                } else {
                    return value;
                }
            }
        }
        const base = new Base();
        expect(base.method(0)).toBe(3);
    });

    test('Call retry twice throws error', () => {
        function methodRescue(_error: any, _args: any[], retry: any): void {
            retry(retry(3));
        }

        @invariant
        class Base {
            @rescue(methodRescue)
            method(value: number): number {
                if(value <= 0) {
                    throw new Error('value must be greater than 0');
                } else {
                    return value;
                }
            }
        }
        const base = new Base();
        expect(() => { base.method(0); }).toThrow(MSG_SINGLE_RETRY);
    });
});

/**
 * Requirement 465
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/465
 */
describe('The @rescue function must preserve the invariant after execution', () => {
    const {invariant, rescue} = new Contracts(true);

    @invariant(function(this: Base) { return this.value > 0; })
    class Base {
        #value = 3;
        get value(): number { return this.#value; }
        set value(v: number) { this.#value = v; }

        @rescue(function(this: Base) { this.value = 5; })
        method1(): void { throw new Error('I am error'); }

        @rescue(function(this: Base) { this.value = -1; })
        method2(): void { throw new Error('I am error'); }
    }

    test('test', () => {
        const base = new Base();
        expect(() => base.method1()).toThrow('I am error');
        expect(base.value).toBe(5);
        expect(() => base.method2()).toThrow(/^Invariant violated/);
        expect(() => base.value).toThrow(/^Invariant violated/);
    });
});

/**
 * Requirement 539
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/539
 */
describe('A class feature with a decorator must not be functional until the @invariant is defined', () => {
    const {invariant, rescue} = new Contracts(true);

    @invariant
    class Okay {
        @rescue(() => {})
        method(value: number): number { return value; }
    }

    test('Valid declaration', () => {
        const okay = new Okay();

        expect(okay.method(15)).toBe(15);
    });

    class Fail {
        @rescue(() => {})
        method(value: number): number { return value; }
    }

    test('Invalid declaration', () => {
        const fail = new Fail();

        expect(() => fail.method(15)).toThrow(MSG_INVARIANT_REQUIRED);
    });
});

/**
 * Requirement 558
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/558
 */
describe('If a @rescue is executed and the retry argument is not called, then an error is thrown', () => {
    const {invariant, rescue} = new Contracts(true);

    @invariant
    class Base {
        @rescue((_error, _args, retry) => { retry(false); })
        throwRescue(trigger: boolean): boolean {
            if(trigger) {
                throw new Error('I am error');
            } else {
                return true;
            }
        }

        @rescue(() => { /* Do nothing */ })
        throwFail(): void {
            throw new Error('I am error');
        }
    }

    const base = new Base();

    test('Rescued error', () => {
        expect(base.throwRescue(true)).toBe(true);
    });

    test('Unrescued error', () => {
        expect(() => base.throwFail()).toThrow('I am error');
    });
});

/**
 * Requirement 559
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/559
 */
describe('If an exception is thrown in a class feature without a @rescue defined, then the exception is raised to its caller after the @invariant is checked', () => {
    const {invariant} = new Contracts(true);

    @invariant
    class A {
        method(): void {
            throw new Error('I am error');
        }
    }

    test('Throwing error without @invariant is raised to caller', () => {
        expect(() => new A().method()).toThrow('I am error');
    });

    @invariant(function(this: B): boolean { return this.value > 0; })
    class B {
        #value = 1;

        get value(): number { return this.#value; }
        set value(v: number) { this.#value = v; }

        method1(): void {
            this.#value = 3;
            throw new Error('I am error');
        }

        method2(): void {
            this.#value = -2;
            throw new Error('I am error');
        }
    }

    test('Throwing error with @invariant', () => {
        expect(() => new B().method1()).toThrow('I am error');
        expect(() => new B().method2()).toThrow(/^Invariant violated/);
    });
});