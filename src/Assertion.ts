/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import AssertionError from './AssertionError';
import Constructor from './typings/Constructor';

/**
 * An assertion is an expression of a property that must be true at a particular
 * point of step of program execution. It consists of a boolean expression
 * and a message.
 *
 * @example
 * let assert = new Assertion(true).assert
 * let x = 15;
 * assert(x > 5, `Expected: x > 5. Actual: x = ${x}`)
 *
 * @example
 * let assert = new Assertion(true).assert
 * let name = "Tom"
 * assert(name.trim().length > 0, 'Name is required', TypeError)
 *
 * @example
 * let assert = new Assertion(true).assert
 * let s: boolean = ...;
 * while(assert(q(s), 'message')) {
 *     ...
 *     s = ...;
 * }
 */
export default class Assertion {
    /**
     * Constructs an instance of the Assertion class in the specified mode.
     * Enabled when checkMode is true, and disabled otherwise
     *
     * @param checkMode - The flag representing mode of the assertion
     */
    constructor(protected checkMode: boolean) {}

    /**
     * Tests the provided condition. If the condition is false an AssertionError is raised with an optional message.
     * If the provided condition is true, then the function returns without raising an error
     *
     * @param condition - The condition to test
     * @param message - A descriptive message to associate with the AssertionError
     * @param ErrorConstructor - The constructor of the Error to use
     * @throws {Error} - When the condition is false
     * @see AssertionError
     */
    assert = (condition: boolean, message: string = 'Assertion failure', ErrorConstructor: Constructor<Error> = AssertionError): boolean => {
        if(this.checkMode && !condition) {
            throw new ErrorConstructor(message);
        }

        return true;
    }
}