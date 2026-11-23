import { AssertionError, type ContractKind, type ContractViolation } from "./AssertionError.mjs";
import type { StandardSchemaV1 } from './standard-schema.mjs';
import { isSchema, type ArmFailures, type ViolationFactory } from './admissibility.mjs';

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
 * Describes a value an arm threw, for the violation record.
 *
 * The record holds a description rather than the value, so that a violation stays
 * plain data and cannot keep the consumer's error alive or make itself
 * unserialisable (see {@link ContractViolation.thrown}). An object is named by its
 * constructor and message, which is what a reader needs to tell a deliberate
 * `Denied` from a `TypeError` raised by a bug.
 */
const describeThrown = (value: unknown): string => {
    if (typeof value === 'object' && value !== null) {
        const named = value as { name?: unknown, message?: unknown },
            name = typeof named.name === 'string' ? named.name : value.constructor?.name ?? 'Object',
            message = typeof named.message === 'string' ? named.message : '';

        return message ? `${name}: ${message}` : name;
    }

    return String(value);
};

/**
 * Renders the failing arms for a message.
 *
 * Predicates and schemas are both arms of the same composition, so each is named
 * as whichever it actually is. Calling a schema a predicate would be wrong;
 * calling a predicate an arm would be vaguer than the caller needs. An arm that
 * threw is marked, so a reader can tell a thrown value from a `false` verdict
 * without unpacking the violation.
 */
const describeArms = (
    arms: readonly unknown[],
    failedIndices: number[],
    predicates: string[],
    thrownIndices: ReadonlySet<number>,
): string => predicates
    .map((source, position) => {
        const index = failedIndices[position],
            noun = isSchema(arms[index]) ? 'schema' : 'predicate',
            how = thrownIndices.has(index) ? ' threw' : '';

        return `${noun} #${index + 1}${how}: ${source}`;
    })
    .join('; ');

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
    thrown?: ReadonlyArray<{ index: number, value: unknown }>,
): { message: string, violation: ContractViolation } {
    const thrownIndices = thrown?.map(entry => entry.index),
        thrownDescriptions = thrown?.map(entry => describeThrown(entry.value));

    const violation: ContractViolation = {
        contract,
        className,
        feature,
        failedIndices,
        predicates: failedIndices.map(index => describe(arms[index])),
        ...(thrownIndices && thrownIndices.length > 0
            ? { thrownIndices, thrown: thrownDescriptions }
            : {}),
        ...(issues && issues.length > 0 ? { issues } : {}),
    };

    return { message: describeMessage(contract, violation, arms, summary, issues), violation };
}

/**
 * Assembles the human-readable half of a contract failure.
 *
 * The structured `violation` carries the same facts for a caller that will branch
 * on them; this string exists for the reader who only ever sees the message, so it
 * names the feature, the unsatisfied arms, anything the failing schemas reported,
 * and what the failure means for the contract.
 */
const describeMessage = (
    contract: ContractKind,
    violation: ContractViolation,
    arms: readonly unknown[],
    summary: string,
    issues: ReadonlyArray<StandardSchemaV1.Issue> | undefined,
): string => {
    const where = violation.feature === undefined
        ? violation.className
        : `${violation.className}.${violation.feature}`,
        threw: ReadonlySet<number> = new Set(violation.thrownIndices ?? []),
        detail = describeArms(arms, violation.failedIndices, violation.predicates, threw),
        noun = (arm: unknown) => isSchema(arm) ? 'schema' : 'predicate',
        nounPlural = (arm: unknown) => isSchema(arm) ? 'schemas' : 'predicates',
        count = pluralise(violation.failedIndices.length, arms.length, noun(arms[0]), nounPlural(arms[0])),
        // Schema arms report `issues` rather than a true/false verdict, so the
        // provider's own explanation is carried into the message. A caller reading
        // only the message still learns which field was rejected and why.
        reported = issues && issues.length > 0
            ? ` Reported: ${issues.map(issue => describeIssue(issue)).join('; ')}.`
            : '';

    return `${contract} failed for ${where} (${count} unsatisfied: ${detail}).${reported} ${summary}`;
};

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
    thrown?: ReadonlyArray<{ index: number, value: unknown }>,
): AssertionError {
    const { message, violation } = describeViolation(
        contract, className, feature, arms, failedIndices, summary, issues, describe, thrown);

    return new AssertionError(message, violation);
}

/**
 * The errors this module has already annotated.
 *
 * Kept so a reused error instance can be recognised as ours and updated, while an
 * error carrying a `cause` of its own is never overwritten. A `WeakMap`-style
 * record is used because the error belongs to the consumer: this must not keep it
 * alive.
 */
const annotated = new WeakSet<object>();

/**
 * Records a contract failure on an error the contract did not create.
 *
 * A predicate's error is the consumer's object. Three things follow, and all are
 * about not damaging it:
 *
 * - **The record is only added to an extensible object.** A frozen or non-extensible
 *   error cannot accept it, and a refusal is silent: the caller still receives the
 *   error they were waiting for, which is the outcome that matters.
 * - **A `cause` the consumer set is never overwritten.** An error constructed with
 *   its own `cause` uses it to record what actually went wrong underneath;
 *   replacing it with the contract's diagnostic would destroy the information
 *   `cause` exists to carry. A record this module wrote earlier *is* replaced, so
 *   that a reused error reports the contract that raised it now rather than the
 *   first one it was thrown from.
 * - **`defineProperty` is used rather than assignment**, so the record is
 *   non-enumerable. A domain error that serialises its own properties for logging
 *   must not suddenly gain a contract record it never asked for.
 * - **A violation the factory supplied is kept.** The factory is handed the record,
 *   so it may carry a narrowed or extended one. What counts as supplying one is a
 *   **value**, not an own property: an optional parameter property on the error class
 *   holds `undefined` until it is assigned, and treating that as a deliberate
 *   omission would strip the error of the record the factory exists to deliver.
 */
const annotate = (
    raised: object,
    violation: ContractViolation,
    cause: AssertionError,
    fromFactory = false,
): void => {
    if (!Object.isExtensible(raised)) return;

    const mine = annotated.has(raised),
        supplied = (key: 'violation' | 'cause'): boolean => {
            if (mine || !Object.hasOwn(raised, key)) return false;

            return !(fromFactory && key === 'violation' && (raised as { violation?: unknown }).violation === undefined);
        };

    for (const [key, value] of [['violation', violation], ['cause', cause]] as const)
        if (!supplied(key))
            Object.defineProperty(raised, key, {
                value,
                enumerable: false,
                configurable: true,
            });

    annotated.add(raised);
};

/**
 * Builds the value a declared factory raises.
 *
 * Split from {@link violationFailure} because what it decides is independent of
 * which contract failed: the factory is the caller's own choice of error type, and
 * the only thing this library adds to what it returns is the record it was given.
 *
 * A returned primitive has nowhere to hold either attachment, so it is refused here
 * rather than silently degrading the report — the caller would otherwise receive a
 * value they cannot inspect. Anything `typeof` calls an object is accepted, so an
 * array passes and carries both fields; narrowing further would reject a
 * consumer's own error-like object for no gain, since the fields are attached
 * whether or not it extends `Error`.
 *
 * @param label - The contract, feature, and class, for the diagnostic.
 * @param error - The `AssertionError` describing every unsatisfied arm.
 */
const factoryFailure = (
    label: string,
    violation: ContractViolation,
    error: AssertionError,
    factory: ViolationFactory,
): unknown => {
    const raised = factory(violation);

    if (typeof raised !== 'object' || raised === null)
        throw new TypeError(
            `${label} returned ${typeof raised}; it must return an object so the violation can be attached.`,
            // The defect replaces the contract failure at the caller, so the
            // failure travels as `cause`: what the factory was asked to report is
            // still readable.
            { cause: error },
        );

    // The violation and the describing `AssertionError` are attached by the same
    // defensive rules a re-raised predicate error gets, so a factory error that
    // carries its own `cause` keeps it. A violation the factory supplied itself
    // also wins, because the factory was given the record and may have narrowed or
    // extended it.
    annotate(raised, violation, error, true);

    return raised;
};

/**
 * Builds the value a contract raises when every arm has failed.
 *
 * A thrown arm is a failed arm, so when every arm failed and at least one of them
 * threw, that value is what the caller receives. A typed error survives the
 * composition it could not otherwise reach, and a predicate bug still surfaces as
 * the bug it is rather than as an `AssertionError` describing a contract.
 *
 * The **first arm that threw** wins, matching the rule that the first arm
 * evaluated decides a normalized value. Arm order is the composition list's, which
 * for one class is reverse source order because decorators evaluate bottom-up, and
 * which places inherited arms before a subclass's own.
 *
 * When no arm threw, the failure is a verdict rather than a fault and an
 * `AssertionError` carrying the full violation is raised as usual.
 *
 * A declared {@link ViolationFactory} supersedes both rules, because it is the
 * caller's explicit choice of error type and it receives the violation — including
 * `thrownIndices` — so nothing is lost by preferring it. It runs only here, after
 * every arm has been evaluated, which is the one point where the failure is final.
 *
 * @param factory - The contract's declared factory, if any arm declared one.
 * @internal
 * Exported only because the three contract modules live in their own files and
 * import it. It takes an `ArmFailures`, which is not part of the published surface,
 * so a consumer cannot call it without reaching into the library's internals.
 */
export function violationFailure(
    contract: ContractKind,
    className: string,
    feature: string | undefined,
    arms: readonly unknown[],
    failures: ArmFailures,
    summary: string,
    describe: (arm: unknown) => string = String,
    factory?: ViolationFactory,
): unknown {
    const error = violationError(
        contract, className, feature, arms, failures.failed, summary,
        failures.issues, describe, failures.thrown),
        violation = error.violation as ContractViolation;

    if (factory)
        return factoryFailure(
            `${contract} onViolation for ${feature === undefined ? className : `${className}.${feature}`}`,
            violation, error, factory,
        );

    if (failures.thrown.length === 0) return error;

    const raised = failures.thrown[0].value;

    // A thrown primitive has nowhere to carry the payload, and replacing it with a
    // wrapper would change the value the contract chose to raise.
    if (typeof raised === 'object' && raised !== null)
        annotate(raised, violation, error);

    return raised;
}
