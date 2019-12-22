/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit testing for the requires decorator
 */

import Contracts from './';
import { MSG_NO_STATIC } from './MemberDecorator';

/**
 * Requirement 241
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/241
 */
describe('The @requires decorator must be a non-static feature decorator only', () => {
    test('Test declaration', () => {
        let {requires} = new Contracts(true);

        expect(() => {
            class Foo {
                @requires(() => true)
                method1() {}

                @requires(() => false)
                method2() {}
            }

            return Foo;
        }).not.toThrow();

        expect(() => {
            //@ts-ignore: ignoring typescript error for JavaScript testing
            @requires(() => true)
            class Foo {}

            return Foo;
        }).toThrow(MSG_NO_STATIC);
    });

    test('Invalid declaration', () => {
        expect(() => {
            let {requires} = new Contracts(true);
            // @ts-ignore: ignore type error for testing
            @requires(() => true)
            class Foo {}

            return Foo;
        }).toThrow();

        expect(() => {
            let {requires} = new Contracts(false);
            // @ts-ignore: ignore type error for testing
            @requires(() => true)
            class Foo {}

            return Foo;
        }).not.toThrow();
    });
});

/**
 * Requirement 244
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/244
 */
describe('Features that override a @requires decorated feature must be subject to that decorator', () => {
    let {invariant, override, requires} = new Contracts(true);

    @invariant
    class Base {
        protected _value = 0;

        protected _nonNegative() {
            return this._value >= 0;
        }

        inc() { this._value++; }

        @requires(Base.prototype._nonNegative)
        dec() { this._value--; }
    }

    class Sub extends Base {
        @override
        dec() {
            this._value -= 2;
        }
    }

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
describe('@requires is evaluated before its associated feature is called', () => {
    let {invariant, requires} = new Contracts(true);

    @invariant
    class Foo {
        protected _value = 0;

        protected _nonNegative() {
            return this._value >= 0;
        }
    }

    test('true @requires check does not throw', () => {
        class Bar extends Foo {
            @requires(Bar.prototype._nonNegative)
            method() {
                return this._value = -2;
            }
        }

        let bar = new Bar();

        expect(bar.method()).toBe(-2);
    });

    test('false @requires check throws', () => {
        class Bar extends Foo {
            @requires(() => false)
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
describe('@requires has a checked mode and unchecked mode', () => {

    test('The associated assertion is evaluated when checkMode = true', () => {
        let {invariant, requires} = new Contracts(true);

        @invariant
        class Foo {
            @requires(() => false)
            method() {}
        }

        expect(() => new Foo().method()).toThrow();
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        let {invariant, requires} = new Contracts(false);

        @invariant
        class Foo {
            @requires(() => false)
            method() {}
        }

        expect(() => new Foo().method()).not.toThrow();
    });
});