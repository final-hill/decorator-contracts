import { assertContractResult } from './assert.mjs';
import { readOnlyView } from './read-only.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';

/**
 * The result of checking a subject against one contract arm.
 *
 * Predicates and schemas are adapted to this shape so that the composition rule
 * in each contract — OR for `@demands`, AND for `@invariant` and `@ensures` — is
 * written once rather than twice.
 *
 * An arm that threw reports `ok: false` with the thrown value preserved in
 * `thrown`. Composition continues past it: an `@demands` arm that throws is one
 * opinion that the call should not proceed, and a later arm may still permit it.
 * Keeping the value instead of letting it propagate is what makes an arm's own
 * error reachable without making the composition rule unreachable.
 */
export type Admissibility = {
    ok: boolean;
    value?: unknown;
    thrown?: unknown;
    issues?: ReadonlyArray<StandardSchemaV1.Issue>
};

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
 * The object a predicate is called with.
 *
 * A predicate takes one argument rather than a positional list, so a contract
 * that supplies a field the predicate does not need costs nothing at the call
 * site: the predicate destructures the fields it reads. Each contract publishes
 * a precise version of this shape — `DemandsSubject`, `EnsuresSubject`,
 * `InvariantSubject`, `RescueSubject` — and this is the part the runtime has in
 * common.
 */
export interface PredicateSubject {
    /** The instance, replaced with a read-only view before the call. */
    readonly self: unknown;
    readonly [field: string]: unknown;
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
    /** The fields a predicate is called with. */
    predicate: () => PredicateSubject;
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
 * Rejects `normalize` on a contract that has nothing to replace.
 *
 * `@invariant` describes the instance, and an invariant predicate or schema answers
 * a question about it; neither produces a value the runtime could substitute. The
 * option was previously accepted here and silently ignored, which reads as a
 * declared intention that is not in force. Rejecting it where it is written keeps
 * the declaration and the behaviour in agreement.
 */
export const assertNotNormalizable = (contract: string, options: ArmOptions | undefined): void => {
    if (!options?.normalize) return;

    throw new TypeError(`${contract} cannot normalize: its subject is the instance, which no arm can replace.`);
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
 *
 * The instance is passed as a read-only view. A predicate answers a question, so
 * it must not be able to change the state it is asked about — see `read-only.mts`
 * for why this is a scoped proxy rather than `Object.freeze`. The view is applied
 * here rather than by the caller so that a predicate can never be invoked with
 * the raw target by mistake.
 */
const evaluatePredicate = (
    predicate: (...args: any[]) => unknown,
    subject: PredicateSubject,
    contract: string,
    label: string,
    index: number,
): Admissibility => {
    // Only `self` is guarded, and the guard is a property of the field rather
    // than of its position. Every other field describes the invocation rather
    // than the instance: `args` and `result` are readable data shared with the
    // caller, `old` is a detached copy taken by `populateOld`, and `error` and
    // `retry` belong to `@rescue`, which is exempt from the view because
    // restoring corrupted state is its purpose.
    const { self, ...rest } = subject,
        guarded = typeof self === 'object' && self !== null
            ? readOnlyView(self)
            : self;

    // A predicate that throws has answered "no": the call it guards must not be
    // denied on its say-so when a sibling arm permits it. The value is carried in
    // `thrown` rather than propagated, so the contract can decide whether it still
    // matters once every arm has been evaluated.
    //
    // The guard covers the predicate **call** only. The verdict is validated
    // outside it, because a non-boolean return is a defect in the predicate rather
    // than a decision about the call: a Promise is truthy, so treating it as a
    // failed arm would let a sibling excuse a contract that never ran. That is the
    // rule `assertContractResult` exists to enforce, and it stays fatal.
    let verdict: unknown;

    try {
        verdict = predicate({ self: guarded, ...rest });
    } catch (thrown) {
        return { ok: false, thrown };
    }

    return { ok: assertContractResult(verdict, contract, label, index) };
};

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
 * The arms that rejected a call, gathered across a composition loop.
 *
 * The three contracts differ in their composition rule but not in what they
 * record about a rejected arm: its index, any issues a schema reported, and the
 * value a throwing predicate raised. Collecting it in one place keeps the loops
 * about their rule rather than about bookkeeping.
 */
export interface ArmFailures {
    failed: number[];
    thrown: { index: number, value: unknown }[];
    issues: StandardSchemaV1.Issue[];
}

/** Starts an empty record for a composition pass. */
export const armFailures = (): ArmFailures => ({ failed: [], thrown: [], issues: [] });

/**
 * Records one rejected arm.
 *
 * A throwing arm also lands in `failed`: it rejected the call, and the
 * distinction the caller needs is `thrown`, not whether the arm was counted.
 */
export const recordFailure = (failures: ArmFailures, index: number, result: Admissibility): void => {
    failures.failed.push(index);

    if (result.issues) failures.issues.push(...result.issues);
    if ('thrown' in result) failures.thrown.push({ index, value: result.thrown });
};

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
