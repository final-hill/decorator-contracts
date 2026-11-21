import { AssertionError, type ContractKind, type ContractViolation } from "./AssertionError.mjs";

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

const pluralise = (count: number, total: number, singular: string, plural: string): string =>
    `${count} of ${total} ${total === 1 ? singular : plural}`;

/**
 * Builds a message for a failed contract and describes it structurally.
 *
 * Every contract reports the same way: which contract failed, on which feature,
 * which predicate(s) failed, and the source text of each. A caller can use the
 * returned violation instead of parsing the message.
 *
 * @param contract - Which contract failed.
 * @param className - The class the contract belongs to.
 * @param feature - The feature the contract belongs to, absent for `@invariant`.
 * @param predicates - The full composition list, so indices are meaningful.
 * @param failedIndices - The indices in `predicates` that failed.
 * @param summary - A per-contract description of what the failure means.
 * @returns The message and the structured violation.
 */
export function describeViolation(
    contract: ContractKind,
    className: string,
    feature: string | undefined,
    predicates: readonly unknown[],
    failedIndices: number[],
    summary: string,
): { message: string, violation: ContractViolation } {
    const violation: ContractViolation = {
        contract,
        className,
        feature,
        failedIndices,
        predicates: failedIndices.map(index => String(predicates[index])),
    };

    const where = feature === undefined ? className : `${className}.${feature}`,
        detail = violation.predicates
            .map((source, position) => `predicate #${failedIndices[position] + 1}: ${source}`)
            .join('; '),
        count = pluralise(failedIndices.length, predicates.length, 'predicate', 'predicates');

    return {
        message: `${contract} failed for ${where} (${count} unsatisfied: ${detail}). ${summary}`,
        violation,
    };
}
