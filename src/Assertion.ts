/*!
 * @license
 * Copyright (C) 2020 Michael L Haufe
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import AssertionError from './AssertionError';
import type {Constructor} from './typings/Constructor';
import { ASSERTION_FAILED } from './Messages';

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
     * @param {boolean} checkMode - The flag representing mode of the assertion
     */
    constructor(protected checkMode: boolean) {
        this.assert = this.assert.bind(this);
    }

    /**
     * Tests the provided condition. If the condition is false an AssertionError is raised with an optional message.
     * If the provided condition is true, then the function returns without raising an error
     *
     * @param {boolean} condition - The condition to test
     * @param {string} message - A descriptive message to associate with the AssertionError
     * @param {Constructor<Error>} ErrorConstructor - The constructor of the Error to use
     * @throws {Error} - When the condition is false
     * @see AssertionError
     * @throws {AssertionError} - Throws an AssertionError by default if the condition is false
     */
    assert(condition: unknown, message = ASSERTION_FAILED, ErrorConstructor: Constructor<Error> = AssertionError): asserts condition {
        if(this.checkMode && Boolean(condition) == false) {
            throw new ErrorConstructor(message);
        }
    }
}