/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit testing for the 'rescue' decorator
 */

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
            method() { return 7; }
        }
        const base = new Base();

        expect(base.method()).toBe(7);
    });

    test('rescue of method with an error then retrying returns ok', () => {
        @invariant
        class Base {
            @rescue((_error: any, _args: any[], retry: any) => retry(3))
            method(value: number) {
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
            @rescue(() => {throw new Error('Rescue throw'); })
            method() {
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
            get value() { return 7; }
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
            get value() {
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
            @rescue((_error: any, _args: any[], _retry: Function) => {
                throw new Error('Not Rescued');
            })
            get value() {
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

            get value() { return this.#value; }
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

            get value() { return this.#value; }

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

            get value() { return this.#value; }
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

        expect(() => {
            @invariant
            class Base {
                protected _baseRescue() {
                    throw new Error('I am still an Error');
                }

                @rescue(Base.prototype._baseRescue)
                throws(value: string) {
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
                throws(value: string) {
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
                method() {}
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
                method() {}
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
        @invariant
        class Base {
            protected _methodRescue(_error: any, _args: any[], retry: any) {
                return retry(3);
            }

            @rescue(Base.prototype._methodRescue)
            method(value: number) {
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
        @invariant
        class Base {
            protected _methodRescue(_error: any, _args: any[], retry: any) {
                return retry(retry(3));
            }

            @rescue(Base.prototype._methodRescue)
            method(value: number) {
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
        get value() { return this.#value; }
        set value(v: number) { this.#value = v; }

        @rescue(function(this: Base) { this.value = 5; })
        method1() { throw new Error('I am error'); }

        @rescue(function(this: Base) { this.value = -1; })
        method2() { throw new Error('I am error'); }
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
 * Requirement 558
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/558
 */
describe('If a @rescue is executed and the retry argument is not called, then an error is thrown', () => {
    const {invariant, rescue} = new Contracts(true);

    @invariant
    class Base {
        @rescue((_error, _args, retry) => { retry(false); })
        throwRescue(trigger: boolean) {
            if(trigger) {
                throw new Error('I am error');
            } else {
                return true;
            }
        }

        @rescue(() => { /* Do nothing */ })
        throwFail() {
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
 * Requirement 539
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/539
 */
describe('A class feature with a decorator must not be functional until the @invariant is defined', () => {
    const {invariant, rescue} = new Contracts(true);

    @invariant
    class Okay {
        @rescue(() => {})
        method(value: number) { return value; }
    }

    test('Valid declaration', () => {
        const okay = new Okay();

        expect(okay.method(15)).toBe(15);
    });

    class Fail {
        @rescue(() => {})
        method(value: number) { return value; }
    }

    test('Invalid declaration', () => {
        const fail = new Fail();

        expect(() => fail.method(15)).toThrow(MSG_INVARIANT_REQUIRED);
    });
});