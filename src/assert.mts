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

const describeContractResult = (value: unknown): string => {
    if (typeof value === 'object' && value !== null && typeof (value as any).then === 'function')
        return 'a Promise (contract predicates must be synchronous)';
    if (typeof value === 'string') return `the string ${JSON.stringify(value)}`;
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'object') return `an object (${Object.prototype.toString.call(value)})`;

    return `a ${typeof value} (${String(value)})`;
}

/**
 * Asserts that a contract predicate returned a `boolean`.
 *
 * Contract predicates must return a boolean. Coercing the result would silently
 * accept a non-boolean, which is how an accidentally asynchronous predicate
 * passes: a `Promise` is always truthy. Treating a contract that never actually
 * ran as satisfied is worse than failing, so a non-boolean result raises an
 * `AssertionError` naming the contract, the feature, and the predicate index.
 *
 * @param result - The value returned by the predicate.
 * @param contract - The name of the contract, e.g. `@demands`.
 * @param label - A human-readable description of the feature, e.g. `Foo.method`.
 * @param index - The zero-based index of the predicate in its composition list.
 * @returns The predicate result, narrowed to `boolean`.
 * @throws {AssertionError} If the predicate did not return a boolean.
 */
export function assertContractResult(
    result: unknown,
    contract: string,
    label: string,
    index: number,
): boolean {
    assert(
        typeof result === 'boolean',
        `${contract} predicate #${index + 1} for ${label} returned ${describeContractResult(result)}; contract predicates must return a boolean`
    );

    return result;
}
