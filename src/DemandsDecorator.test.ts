/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit testing for the demands decorator
 */

import Contracts from '.';
import { MSG_NO_STATIC } from './MemberDecorator';
import AssertionError from './AssertionError';

/**
 * Requirement 241
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/241
 */
describe('The @demands decorator must be a non-static feature decorator only', () => {
    test('Test declaration', () => {
        let {demands} = new Contracts(true);

        expect(() => {
            class Foo {
                @demands(() => true)
                method1() {}

                @demands(() => false)
                method2() {}
            }

            return Foo;
        }).not.toThrow();

        expect(() => {
            //@ts-ignore: ignoring typescript error for JavaScript testing
            @demands(() => true)
            class Foo {}

            return Foo;
        }).toThrow(MSG_NO_STATIC);
    });

    test('Invalid declaration', () => {
        expect(() => {
            let {demands} = new Contracts(true);
            // @ts-ignore: ignore type error for testing
            @demands(() => true)
            class Foo {}

            return Foo;
        }).toThrow();

        expect(() => {
            let {demands} = new Contracts(false);
            // @ts-ignore: ignore type error for testing
            @demands(() => true)
            class Foo {}

            return Foo;
        }).not.toThrow();
    });
});

/**
 * Requirement 242
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/242
 */
describe('There can be multiple @demands decorators assigned to a class feature', () => {
    let {invariant, demands} = new Contracts(true);

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

        @demands(Foo.prototype._nonNegative)
        @demands(Foo.prototype._isEven)
        inc() { this._value += 2; }

        @demands(Foo.prototype._nonNegative)
        @demands(Foo.prototype._isEven)
        dec() { this._value -= 1; }
    }

    let foo = new Foo();

    expect(() => foo.inc()).not.toThrow();

    expect(foo.value).toBe(2);

    expect(() => {
        foo.dec();
        foo.dec();
    }).toThrow(AssertionError); // TODO: more specific error
});

/**
 * Requirement 244
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/244
 */
describe('Features that override a @demands decorated feature must be subject to that decorator', () => {
    let {invariant, override, demands} = new Contracts(true);

    @invariant
    class Base {
        protected _value = 0;

        protected _nonNegative() {
            return this._value >= 0;
        }

        inc() { this._value++; }

        @demands(Base.prototype._nonNegative)
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

    test('dec(); dec(); throws', () => {
        expect(() => {
            let sub = new Sub();
            sub.dec();
            sub.dec();
        }).toThrow();
    });
});

/**
 * Requirement 246
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/246
 */
describe('@demands is evaluated before its associated feature is called', () => {
    let {invariant, demands} = new Contracts(true);

    @invariant
    class Foo {
        protected _value = 0;

        protected _nonNegative() {
            return this._value >= 0;
        }
    }

    test('true @demands check does not throw', () => {
        class Bar extends Foo {
            @demands(Bar.prototype._nonNegative)
            method() {
                return this._value = -2;
            }
        }

        let bar = new Bar();

        expect(bar.method()).toBe(-2);
    });

    test('false @demands check throws', () => {
        class Bar extends Foo {
            @demands(() => false)
            method() {
                return this._value = 12;
            }
        }
        let bar = new Bar();

        expect(() => { bar.method(); }).toThrow();
    });
});

/**
 * Requirement 248
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/248
 */
describe('@demands has a checked mode and unchecked mode', () => {

    test('The associated assertion is evaluated when checkMode = true', () => {
        let {invariant, demands} = new Contracts(true);

        @invariant
        class Foo {
            @demands(() => false)
            method() {}
        }

        expect(() => new Foo().method()).toThrow();
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        let {invariant, demands} = new Contracts(false);

        @invariant
        class Foo {
            @demands(() => false)
            method() {}
        }

        expect(() => new Foo().method()).not.toThrow();
    });
});

/**
 * Requirement 396
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/396
 */
describe('Preconditions cannot be strengthened in a subtype', () => {
    let {invariant, demands, override} = new Contracts(true);

    @invariant
    class Base {
        @demands((value: number) => 10 <= value && value <= 30)
        method(value: number) { return value; }
    }

    test('Base precondition', () => {
        let base = new Base();

        expect(base.method(15)).toBe(15);
        expect(() => base.method(5)).toThrow(
            `Precondition failed on Base.prototype.method`
        );
        expect(() => base.method(35)).toThrow(
            `Precondition failed on Base.prototype.method`
        );
    });

    class Weaker extends Base {
        @override
        @demands((value: number) => 1 <= value && value <= 50)
        method(value: number) { return value; }
    }

    test('Weaker precondition', () => {
        let weaker = new Weaker();

        expect(weaker.method(15)).toBe(15);
        expect(weaker.method(5)).toBe(5);
        expect(weaker.method(35)).toBe(35);
        expect(() => weaker.method(0)).toThrow(
            `Precondition failed on Weaker.prototype.method`
        );
        expect(() => weaker.method(60)).toThrow(
            `Precondition failed on Weaker.prototype.method`
        );
    });

    class Stronger extends Base {
        @override
        @demands((value: number) => 15 <= value && value <= 20)
        method(value: number) { return value; }
    }

    test('Stronger precondition', () => {
        let stronger = new Stronger();

        expect(stronger.method(15)).toBe(15);
        expect(() => stronger.method(5)).toThrow(
            `Precondition failed on Stronger.prototype.method`
        );
        expect(() => stronger.method(35)).toThrow(
            `Precondition failed on Stronger.prototype.method`
        );
        expect(stronger.method(25)).toBe(25);
    });
});