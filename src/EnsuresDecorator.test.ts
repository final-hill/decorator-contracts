/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit tests for the ensures decorator
 */

import Contracts from '.';
import { MSG_NO_STATIC } from './MemberDecorator';
import AssertionError from './AssertionError';

/**
 * Requirement 242
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/277
 */
describe('The @ensures decorator must be a non-static method decorator only', () => {
    test('Test declaration', () => {
        let {ensures} = new Contracts(true);

        expect(() => {
            class Foo {
                @ensures(() => true)
                method1() {}

                @ensures(() => false)
                method2() {}
            }

            return Foo;
        }).not.toThrow();

        expect(() => {
            //@ts-ignore: ignoring typescript error for JavaScript testing
            @ensures(() => true)
            class Foo {}

            return Foo;
        }).toThrow(MSG_NO_STATIC);
    });

    test('Invalid declaration', () => {
        expect(() => {
            let {ensures} = new Contracts(true);
            // @ts-ignore: ignore type error for testing
            @ensures(() => true)
            class Foo {}

            return Foo;
        }).toThrow();

        expect(() => {
            let {ensures} = new Contracts(false);
            // @ts-ignore: ignore type error for testing
            @ensures(() => true)
            class Foo {}

            return Foo;
        }).not.toThrow();
    });
});

/**
 * Requirement 278
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/278
 */
describe('There can be multiple @ensures decorators assigned to a class feature', () => {
    let {invariant, ensures} = new Contracts(true);

    @invariant
    class Foo {
        protected _value = 0;

        get value() { return this._value; }

        protected _nonNegative() {
            return this._value >= 0;
        }
        protected _isEven() {
            return this._value % 2 == 0;
        }

        @ensures(Foo.prototype._nonNegative)
        @ensures(Foo.prototype._isEven)
        inc() { this._value += 2; }

        @ensures(Foo.prototype._nonNegative)
        @ensures(Foo.prototype._isEven)
        dec() { this._value -= 1; }
    }

    let foo = new Foo();

    expect(() => foo.inc()).not.toThrow();

    expect(foo.value).toBe(2);

    expect(() => {
        foo.dec();
    }).toThrow(AssertionError); // TODO: more specific error
});

/**
 * Requirement 280
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/280
 */
describe('Features that override a @ensures decorated method must be subject to that decorator', () => {
    let {invariant, override, ensures} = new Contracts(true);

    @invariant
    class Base {
        protected _value = 0;

        protected _nonNegative() {
            return this._value >= 0;
        }

        inc() { this._value++; }

        @ensures(Base.prototype._nonNegative)
        dec() { this._value--; }
    }

    class Sub extends Base {
        @override
        dec() {
            this._value -= 2;
        }
    }

    // TODO: test multiple overrides

    test('inc(); inc(); dec(); does not throw', () => {
        expect(() => {
            let sub = new Sub();
            sub.inc();
            sub.inc();
            sub.dec();
        }).not.toThrow();
    });

    test('dec(); throws', () => {
        expect(() => {
            let sub = new Sub();
            sub.dec();
        }).toThrow();
    });
});

/**
 * Requirement 284
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/284
 */
describe('@ensures is evaluated after its associated member is called', () => {
    let {invariant, ensures} = new Contracts(true);

    @invariant
    class Foo {
        protected _value = 0;

        protected _nonNegative() {
            return this._value >= 0;
        }
    }

    test('true @ensures check does not throw', () => {
        class Bar extends Foo {
            @ensures(Bar.prototype._nonNegative)
            method() {
                return this._value = 2;
            }
        }

        let bar = new Bar();

        expect(bar.method()).toBe(2);
    });

    test('false @ensures check throws', () => {
        class Bar extends Foo {
            @ensures(() => false)
            method() {
                return this._value = 12;
            }
        }
        let bar = new Bar();

        expect(() => { bar.method(); }).toThrow();
    });
});

/**
 * Requirement 286
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/286
 */
describe('@ensures has a checked mode and unchecked mode', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        let {invariant, ensures} = new Contracts(true);

        @invariant
        class Foo {
            @ensures(() => false)
            method() {}
        }

        expect(() => new Foo().method()).toThrow();
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        let {invariant, ensures} = new Contracts(false);

        @invariant
        class Foo {
            @ensures(() => false)
            method() {}
        }

        expect(() => new Foo().method()).not.toThrow();
    });
});

/**
 * Requirement 397
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/397
 */
describe('Postconditions cannot be weakened in a subtype', () => {
    let {invariant, ensures, override} = new Contracts(true);

    @invariant
    class Base {
        @ensures((value: number) => 10 <= value && value <= 30)
        method(value: number) { return value; }
    }

    test('Base postcondition', () => {
        let base = new Base();

        expect(base.method(15)).toBe(15);
        expect(base.method(25)).toBe(25);
        expect(() => base.method(5)).toThrow(`Postcondition failed on Base.prototype.method`);
        expect(() => base.method(35)).toThrow(`Postcondition failed on Base.prototype.method`);
    });

    class Weaker extends Base {
        @override
        @ensures((value: number) => 1 <= value && value <= 50)
        method(value: number) { return value; }
    }

    test('Weaker postcondition', () => {
        let weaker = new Weaker();

        expect(weaker.method(15)).toBe(15);
        expect(weaker.method(25)).toBe(25);
        expect(() => weaker.method(5)).toThrow(`Postcondition failed on Weaker.prototype.method`);
        expect(() => weaker.method(35)).toThrow(`Postcondition failed on Weaker.prototype.method`);
    });

    class Stronger extends Base {
        @override
        @ensures((value: number) => 15 <= value && value <= 20)
        method(value: number) { return value; }
    }

    test('Stronger precondition', () => {
        let stronger = new Stronger();

        expect(stronger.method(15)).toBe(15);
        expect(stronger.method(20)).toBe(20);
        expect(() => stronger.method(25)).toThrow(`Postcondition failed on Stronger.prototype.method`);
        expect(() => stronger.method(5)).toThrow(`Postcondition failed on Stronger.prototype.method`);
        expect(() => stronger.method(35)).toThrow(`Postcondition failed on Stronger.prototype.method`);
    });
});