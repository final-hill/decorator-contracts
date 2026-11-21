import { assertContractResult } from './assert.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';

/**
 * The result of checking a subject against one contract arm.
 *
 * Predicates and schemas are adapted to this shape so that the composition rule
 * in each contract — OR for `@demands`, AND for `@invariant` and `@ensures` — is
 * written once rather than twice.
 */
export type Admissibility = { ok: boolean; value?: unknown; issues?: ReadonlyArray<StandardSchemaV1.Issue> };

/** Options a decorator accepts alongside an arm. */
export interface ArmOptions {
    /**
     * Replace the subject with the schema's `Output`.
     *
     * Off by default. `validate` may transform what it returns, and applying that
     * transformation changes what the feature body receives and what later
     * contracts observe, so it is an explicit choice rather than a side effect of
     * validation. Only a schema can normalize.
     */
    normalize?: boolean;
}

/**
 * The two subjects a contract arm can observe.
 *
 * A predicate and a schema look at different things even within one contract: an
 * `@ensures` predicate needs the invocation and the historical instance, while a
 * schema in the same position validates the result. Passing both explicitly keeps
 * that difference visible at each call site instead of hiding it behind a
 * convention.
 */
export interface ArmSubjects {
    /** The arguments a predicate is called with. */
    predicate: () => any[];
    /** The value a schema arm validates. */
    schema: () => unknown;
}

/**
 * True when a value is a `StandardSchemaV1` rather than a predicate.
 *
 * The check is structural: any object exposing a `~standard` property is treated
 * as a schema, which is what makes the protocol provider-agnostic. A predicate is
 * callable and has no such property.
 */
export const isSchema = (arm: unknown): arm is StandardSchemaV1 =>
    typeof arm === 'object' && arm !== null && '~standard' in arm;

/**
 * Describes an arm for a failure message.
 *
 * Schemas are identified by vendor because their `String()` form is opaque and
 * the caller needs to know which provider produced the arm.
 */
export const describeArm = (arm: unknown): string => {
    if (isSchema(arm)) {
        const { vendor, version } = arm['~standard'];

        return `Standard Schema (vendor: ${String(vendor)}, version: ${String(version)})`;
    }

    return String(arm);
}

/**
 * Rejects `normalize` on an arm that cannot honour it.
 *
 * Called at decoration time so an impossible declaration fails where it is
 * written rather than on the first invocation. A predicate reports a verdict, not
 * a replacement value.
 */
export const assertNormalizable = (arm: unknown, contract: string, options: ArmOptions | undefined): void => {
    if (!options?.normalize || isSchema(arm)) return;

    throw new TypeError(`${contract} cannot normalize: only a Standard Schema arm produces a replacement value.`);
}

/**
 * Checks one arm against the subject that belongs to it.
 *
 * @param arm - A predicate or a `StandardSchemaV1` value.
 * @param subjects - What the arm observes, chosen by the calling contract.
 * @param contract - The contract name, for the diagnostic.
 * @param label - The feature, for the diagnostic.
 * @param index - The arm's position in its composition list.
 * @param options - Declaration options for this arm.
 */
export const evaluateArm = (
    arm: unknown,
    subjects: ArmSubjects,
    contract: string,
    label: string,
    index: number,
    options?: ArmOptions,
): Admissibility => isSchema(arm)
    ? evaluateSchema(arm, subjects.schema(), contract, label, index, options)
    : evaluatePredicate(
        arm as (...args: any[]) => unknown,
        subjects.predicate(),
        contract,
        label,
        index,
    );

/**
 * Applies a predicate arm, reusing the strict-boolean rule from #283.
 *
 * Reusing `assertContractResult` keeps the diagnostic identical whether the
 * predicate was declared on its own or alongside a schema.
 */
const evaluatePredicate = (
    predicate: (...args: any[]) => unknown,
    args: any[],
    contract: string,
    label: string,
    index: number,
): Admissibility => ({
    ok: assertContractResult(predicate(...args), contract, label, index),
});

/**
 * Applies a schema arm by calling its `validate`.
 *
 * A `validate` that returns a Promise is refused. Contract evaluation is
 * synchronous, so an asynchronous schema has decided nothing at the point where
 * the verdict is needed; treating it as satisfied would be worse than failing,
 * and awaiting would move the feature's boundary.
 */
const evaluateSchema = (
    schema: StandardSchemaV1,
    subject: unknown,
    contract: string,
    label: string,
    index: number,
    options: ArmOptions | undefined,
): Admissibility => {
    const result = schema['~standard'].validate(subject) as any;

    if (typeof result?.then === 'function')
        throw new TypeError(
            `${contract} schema #${index + 1} for ${label} returned a Promise; `
            + 'contract evaluation is synchronous, so use a synchronous schema.',
        );

    if (result.issues)
        return { ok: false, issues: result.issues as ReadonlyArray<StandardSchemaV1.Issue> };

    return options?.normalize ? { ok: true, value: result.value } : { ok: true };
}

/**
 * Renders schema `issues` for a message.
 *
 * A path is reported as a dotted trail of keys, matching how the providers
 * describe a nested failure themselves.
 */
export const describeIssues = (issues: ReadonlyArray<StandardSchemaV1.Issue>): string =>
    issues
        .map(issue => {
            const path = (issue.path ?? [])
                .map(segment => typeof segment === 'object' && segment !== null ? segment.key : segment)
                .join('.');

            return path ? `${path}: ${issue.message}` : issue.message;
        })
        .join('; ');
