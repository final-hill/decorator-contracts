/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit tests for the override decorator
 */

import OverrideDecorator from './OverrideDecorator';

/**
 * Requirement 210
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/210
 */
describe('The override decorator is a non-static method decorator only', () => {
    let override = new OverrideDecorator(true).override;

    test('class decorator throws', () => {
        expect(() => {
            // @ts-ignore: Ignoring type error for JS test
            @override
            class Base {}

            return Base;
        }).toThrow();
    });

    test('static method decorator throws', () => {
        expect(() => {
            class Base {
                @override
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
                @override
                method() {}
            }

            return Sub;
        }).not.toThrow();
    });
});

/**
 * Requirement 211
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/211
 */
describe('In production mode the @override decorator is a no-op', () => {
    let override = new OverrideDecorator(false).override;

    test('base class with @override decorator', () => {
        expect(() => {
            class Base {
                @override
                method() {}
            }

            return Base;
        }).not.toThrow();
    });
});

/**
 * Requirement 212
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/212
 */
describe('Using @override on a method with no ancestor method is an error', () => {
    let override = new OverrideDecorator(true).override;

    test('base class with @override decorator', () => {
        expect(() => {
            class Base {
                @override
                method() {}
            }

            return Base;
        }).toThrow();
    });

    test('subclass with @override decorator', () => {
        expect(() => {
            class Base {}

            class Sub extends Base {
                @override
                method() {}
            }

            return Sub;
        }).toThrow();
    });
});