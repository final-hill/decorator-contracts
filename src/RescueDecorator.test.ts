/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit testing for the 'rescue' decorator
 */

import Contracts from './';

/**
 * Requirement 398
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/398
 */
describe('A member with a @rescue defined must also have an @invariant defined on self or ancestor class', () => {

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
 * Requirement 434
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/434
 */
describe('The @rescue constructor has a debugMode that enables its execution', () => {
    test('enabled', () => {
        let {invariant, rescue} = new Contracts(true);

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