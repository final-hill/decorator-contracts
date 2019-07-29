/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import AssertionError from './AssertionError';

/**
 * Tests the provided condition. If the condition is false an AssertionError is raised with an optional message.
 * If the provided condition is true, then the function returns without raising an error
 *
 * @param condition - The condition to test
 * @param message - A descriptive message to associate with the AssertionError
 * @param ErrorConstructor - The constructor of the Error to use
 * @throws {Error} - When the condition is false
 * @see AssertionError
 *
 * @example
 * let x = 15;
 * assert(x > 5, `Expected: x > 5. Actual: x = ${x}`)
 *
 * @example
 * let name = "Tom"
 * assert(name.trim().length > 0, 'Name is required', TypeError)
 *
 * @example
 * let s: boolean = ...;
 * while(assert(q(s), 'message')) {
 *     ...
 *     s = ...;
 * }
 */
function debugAssert(condition: boolean, message: string = 'Assertion failure', ErrorConstructor: Constructor<Error> = AssertionError): boolean {
    if(!condition) {
        throw new ErrorConstructor(message);
    }

    return true;
}

// @ts-ignore : ignoring unused variable warning
function prodAssert(condition: boolean, message: string = 'Assertion failure', ErrorConstructor: Constructor<Error> = AssertionError): boolean {
    return true;
}

/**
 * Returns a reference to the appropriate assertion implementation based on debugMode.
 * Assertions are enabled when debugMode is true, and disabled otherwise
 *
 * @param debugMode - The flag representing mode of the library
 */
export default function assertionFactory(debugMode: boolean) {
    return debugMode ? debugAssert : prodAssert;
}