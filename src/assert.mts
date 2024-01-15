/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import AssertionError from './AssertionError.mjs';
import { Messages } from './Messages.mjs';
import { Constructor } from './index.mjs';

/**
 * An assertion is an expression of a property that must be true at a particular
 * point of step of program execution. It consists of a boolean expression
 * and a message. This function tests the provided condition. If the condition
 * is false an AssertionError is raised with an optional message.
 * If the provided condition is true then the function returns without raising an error
 *
 * @param {boolean} condition - The condition to test
 * @param {string} message - A descriptive message to associate with the AssertionError
 * @param {ClassType<Error>} ErrorConstructor - The constructor of the Error to use
 * @throws {Error} - When the condition is false
 * @see AssertionError
 * @throws {AssertionError} - Throws an AssertionError by default if the condition is false
 *
 * @example
 * let x = 15;
 * assert(x > 5, `Expected: x > 5. Actual: x = ${x}`)
 *
 * @example
 * let name = "Tom"
 * assert(name.trim().length > 0, 'Name is required', TypeError)
 */
export default function assert(condition: unknown, message: string = Messages.AssertionFailed, ErrorConstructor: Constructor<Error> = AssertionError): asserts condition {
    if (Boolean(condition) == false)
        throw new ErrorConstructor(message);
}