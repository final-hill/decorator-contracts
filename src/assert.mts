import { AssertionError, type ContractKind, type ContractViolation } from "./AssertionError.mjs";
import type { StandardSchemaV1 } from './standard-schema.mjs';
import { isSchema } from './admissibility.mjs';

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
 * Renders one schema issue, including its path when the provider supplied one.
 *
 * A path is shown as a dotted trail of keys, which is how the providers describe
 * a nested failure themselves.
 */
const describeIssue = (issue: StandardSchemaV1.Issue): string => {
    const path = (issue.path ?? [])
        .map(segment => typeof segment === 'object' && segment !== null ? segment.key : segment)
        .join('.');

    return path ? `${path}: ${issue.message}` : issue.message;
}

/**
 * Builds a message for a failed contract and describes it structurally.
 *
 * Every contract reports the same way: which contract failed, on which feature,
 * which arm(s) failed, and how each one is described. A caller can use the
 * returned violation instead of parsing the message.
 *
 * @param contract - Which contract failed.
 * @param className - The class the contract belongs to.
 * @param feature - The feature the contract belongs to, absent for `@invariant`.
 * @param arms - The full composition list, so indices are meaningful.
 * @param failedIndices - The indices in `arms` that failed.
 * @param summary - A per-contract description of what the failure means.
 * @param issues - `issues` reported by failing schema arms, if any.
 * @param describe - Renders one arm for the message.
 * @returns The message and the structured violation.
 */
export function describeViolation(
    contract: ContractKind,
    className: string,
    feature: string | undefined,
    arms: readonly unknown[],
    failedIndices: number[],
    summary: string,
    issues?: ReadonlyArray<StandardSchemaV1.Issue>,
    describe: (arm: unknown) => string = String,
): { message: string, violation: ContractViolation } {
    const violation: ContractViolation = {
        contract,
        className,
        feature,
        failedIndices,
        predicates: failedIndices.map(index => describe(arms[index])),
        ...(issues && issues.length > 0 ? { issues } : {}),
    };

    const where = feature === undefined ? className : `${className}.${feature}`,
        // Predicates and schemas are both arms of the same composition, so the
        // message names whichever the failing one actually is. Calling a schema a
        // predicate would be wrong; calling a predicate an arm would be vaguer
        // than the caller needs.
        noun = (arm: unknown) => isSchema(arm) ? 'schema' : 'predicate',
        nounPlural = (arm: unknown) => isSchema(arm) ? 'schemas' : 'predicates',
        detail = violation.predicates
            .map((source, position) => {
                const arm = arms[failedIndices[position]];

                return `${noun(arm)} #${failedIndices[position] + 1}: ${source}`;
            })
            .join('; '),
        count = pluralise(failedIndices.length, arms.length, noun(arms[0]), nounPlural(arms[0]));

    // Schema arms report `issues` rather than a true/false verdict, so the
    // provider's own explanation is carried into the message. A caller reading
    // only the message still learns which field was rejected and why.
    const reported = issues && issues.length > 0
        ? ` Reported: ${issues.map(issue => describeIssue(issue)).join('; ')}.`
        : '';

    return {
        message: `${contract} failed for ${where} (${count} unsatisfied: ${detail}).${reported} ${summary}`,
        violation,
    };
}

/**
 * Builds the error for a contract whose arms were not satisfied.
 *
 * Every contract reports the same way — a message naming the feature and the
 * arms that failed, plus the structured violation — so the identical
 * `describeViolation` + `throw new AssertionError` tail is produced here instead
 * of being written in each of `@invariant`, `@demands`, and `@ensures`.
 *
 * The composition rule stays with each contract, because it is not shared:
 * `@demands` is OR-composed (a subtype may weaken a precondition) while
 * `@invariant` and `@ensures` are AND-composed.
 */
export function violationError(
    contract: ContractKind,
    className: string,
    feature: string | undefined,
    arms: readonly unknown[],
    failedIndices: number[],
    summary: string,
    issues?: ReadonlyArray<StandardSchemaV1.Issue>,
    describe: (arm: unknown) => string = String,
): AssertionError {
    const { message, violation } = describeViolation(
        contract, className, feature, arms, failedIndices, summary, issues, describe);

    return new AssertionError(message, violation);
}
