/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit testing for the 'rescue' decorator
 */

import Contracts from './';

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
                @rescue
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
                @rescue
                method() {}
            }

            return Sub;
        }).not.toThrow();
    });
 });

/**
 * Requirement 434
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/434
 */
describe('The @rescue constructor has a debugMode that enables its execution', () => {
    test('enabled', () => {
        let {rescue} = new Contracts(true);

        expect(() => {
            class Base {}
        }).toThrow();
    });

    test('disabled', () => {
        let {rescue} = new Contracts(false);

        expect(() => {
            class Base {}
        }).not.toThrow();
    });
});