/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit testing for the 'rescue' decorator
 */

import Contracts from './';
import { MSG_DUPLICATE_RESCUE } from './RescueDecorator';
import { MSG_INVARIANT_REQUIRED } from './MemberDecorator';

/**
 * Requirement 398
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/398
 */
describe('A feature with a @rescue defined must also have an @invariant defined on its class or ancestor class', () => {
    let {invariant, rescue} = new Contracts(true);

    test('Missing @invariant throws', () => {
        expect(() => {
            class Base {
                @rescue(() => {})
                method() {}
            }

            return new Base().method();
        }).toThrow(MSG_INVARIANT_REQUIRED);
    });

    test('@rescue w/ @invariant on same class okay', () => {
        expect(() => {
            @invariant
            class Base {
                @rescue(() => {})
                method() {}
            }

            return new Base().method();
        }).not.toThrow();
    });
});

 /**
  * Requirement 399
  * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/399
  */
describe('@rescue is a non-static member decorator only', () => {
    let {rescue} = new Contracts(true);

    test('class decorator throws', () => {
        expect(() => {
            // @ts-ignore: Ignoring type error for JS test
            @rescue
            class Base {}

            return Base;
        }).toThrow();
    });

    test('static method decorator throws', () => {
        expect(() => {
            class Base {
                @rescue(() => {})
                static method() {}
            }

            return Base;
        }).toThrow();
    });
    test('instance method decorator does not throw', () => {
        expect(() => {
            class Base {
                method() {}
            }

            class Sub extends Base {
                @rescue(() => {})
                method() {}
            }

            return Sub;
        }).not.toThrow();
    });
 });

/**
 * Requirement 400
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/400
 */
describe('Any error thrown by a class feature must be captured by its @rescue', () => {
    let {invariant, rescue} = new Contracts(true);

    test('rescuing non-error method returns normal', () => {
        @invariant
        class Base {
            @rescue(() => {})
            method() { return 7; }
        }
        let base = new Base();

        expect(base.method()).toBe(7);
    });

    test('rescue of method with an error then retrying returns ok', () => {
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
        let base = new Base();
        expect(base.method(0)).toBe(3);
    });

    test('rescue of method with an error then rethrow throws to caller', () => {
        @invariant
        class Base {
            protected _methodRescue(_error: any, _args: any[], _retry: any) {
                throw new Error('Rescue throw');
            }

            @rescue(Base.prototype._methodRescue)
            method() {
                throw new Error('Method error');
            }
        }
        let base = new Base();
        expect(() => base.method()).toThrow('Rescue throw');
    });

    test('rescuing non-error getter returns normal', () => {
        @invariant
        class Base {
            @rescue(() => {})
            get value() { return 7; }
        }
        let base = new Base();
        expect(base.value).toBe(7);
    });

    test('rescuing error getter then retry returns ok', () => {
        @invariant
        class Base {
            private _value = 0;
            protected _valueRescue(_error: any, _args: any[], retry: Function) {
                this._value = 7;

                return retry();
            }

            @rescue(Base.prototype._valueRescue)
            get value() {
                if(this._value == 0) {
                    throw new Error('Bad State');
                } else {
                    return this._value;
                }
             }
        }
        let base = new Base();
        expect(base.value).toBe(7);
    });

    test('rescue of error getter then rethrow throws to caller', () => {
        @invariant
        class Base {
            protected _valueRescue(_error: any, _args: any[], _retry: Function) {
                throw new Error('Not Rescued');
            }

            @rescue(Base.prototype._valueRescue)
            get value() {
                throw new Error('Not implemented');
             }
        }
        let base = new Base();
        expect(() => base.value).toThrow('Not Rescued');
    });

    test('rescuing non-error setter then getting returns normal', () => {
        @invariant
        class Base {
            private _value = NaN;

            get value() { return this._value; }
            @rescue(() => {})
            set value(value: number) { this._value = value; }
        }
        let base = new Base();
        base.value = 12;
        expect(base.value).toBe(12);
    });

    test('rescue of error setter then retry then getting returns ok', () => {
        @invariant
        class Base {
            private _value = NaN;

            protected _valueRescue(_error: any, _args: any[], retry: Function) {
                return retry(0);
            }

            get value() { return this._value; }
            @rescue(Base.prototype._valueRescue)
            set value(value: number) {
                if(Number.isNaN(value)) {
                    throw new Error('NaN not allowed');
                }
                this._value = value;
            }
        }
        let base = new Base();
        base.value = NaN;
        expect(base.value).toBe(0);
    });

    test('rescue of error setter then rethrow throw error at caller', () => {
        @invariant
        class Base {
            private _value = NaN;

            protected _valueRescue() { throw new Error('Rescue fail'); }

            get value() { return this._value; }
            @rescue(Base.prototype._valueRescue)
            set value(_: number) { throw new Error('Setter fail'); }
        }
        let base = new Base();
        expect(() => base.value = 12).toThrow('Rescue fail');
    });
});

/**
 * Requirement 434
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/434
 */
describe('The @rescue constructor has a debugMode that enables its execution', () => {
    test('enabled', () => {
        let {invariant, rescue} = new Contracts(true);

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

            let base = new Base();
            base.throws('I am Error');
        }).toThrow('I am still an Error');
    });

    test('disabled', () => {
        let {invariant, rescue} = new Contracts(false);

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

            let base = new Base();
            base.throws('I am Error');
        }).toThrow('I am Error');
    });
});

/**
 * Requirement 455
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/455
 */
describe('Only a single @rescue can be assigned to a method or accessor', () => {
    let {invariant, rescue} = new Contracts(true);

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