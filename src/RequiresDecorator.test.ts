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