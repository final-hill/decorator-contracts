import { AssertionError } from "./AssertionError.mjs";

/**
 * An assertion is an expression of a property that must be true at a particular
 * point of step of program execution. It consists of a boolean expression
 * and a message. This function tests the provided condition. If the condition
 * is false an AssertionError is raised with an optional message.
 * If the provided condition is true then the function returns without raising an error
 *
 * @param condition - The condition to test. If it is false an error is raised.
 * @param message - The message to display if the condition is false. If not provided a default message is used.
 * @throws {AssertionError} If the condition is false an AssertionError is raised.
 *
 * @example
 * ```ts
 * import assert from "assert.mjs";
 *
 * let x = 15;
 * assert(x > 5, `Expected: x > 5. Actual: x = ${x}`);
 * ```
 */

export function assert(condition: unknown, message: string = 'Assertion Error'): asserts condition {
    if (Boolean(condition) == false)
        throw new AssertionError(message);
}
