import { assertContractResult } from './assert.mjs';
import type { ContractViolation } from './AssertionError.mjs';
import { readOnlyView } from './read-only.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';

/**
 * Converts a failed contract into the error its caller receives.
 *
 * It is called once, after **every** arm has failed, with the structured
 * violation. That position is the whole reason the option exists: a predicate
 * must not throw, because an arm that throws is one opinion that the call should
 * not proceed rather than an abort of the composition, so a typed error cannot be
 * raised from inside one. A factory runs where the decision is already made.
 *
 * The return value must be an object. The violation and the `AssertionError` that
 * describes every unsatisfied arm are attached to it, so an error that could carry
 * neither would silently lose the contract details.
 */
export type ViolationFactory = (violation: ContractViolation) => object;

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

    /**
     * Build the error raised when the arm's contract fails.
     *
     * Receives the full `ContractViolation`, because that record is the only
     * machine-readable part of a failure: an error boundary or a metadata-driven
     * test needs `failedIndices`, `thrownIndices`, and the schema `issues`, and a
     * bare constructor would discard them.
     *
     * Scope is **per contract, not per arm.** When several arms declare a factory,
     * the one belonging to the **first arm evaluated** decides, matching the rule
     * that the first arm decides a normalized value. Arms evaluate in the contract's
     * composition order — reverse source order within a class, inherited arms
     * first — so the factory that wins is the one whose declaration is read first by
     * the runtime.
     *
     * The returned error carries the violation as `violation` and the
     * `AssertionError` describing every unsatisfied arm as `cause`, both
     * non-enumerable. A factory that returns a non-object is refused when it runs,
     * since neither field could be attached to it; what it produces depends on the
     * violation, so there is nothing to check at decoration time. The guard admits
     * anything `typeof` reports as an object, so an array passes and carries both
     * fields — it is the author's choice whether an error boundary can branch on it.
     *
     * A `@rescue` that retries calls the factory once per failed attempt, because
     * each attempt is a separate failure with its own violation.
     */
    onViolation?: ViolationFactory;

    /**
     * Suppress the warning a subclass `@demands` arm raises for narrowing.
     *
     * `@demands` is OR-composed, so an arm added below an inherited one cannot
     * narrow the precondition — satisfying any inherited arm still permits the
     * call. That is easy to misread as a restriction, so declaring an arm on a
     * feature that already has inherited arms warns.
     *
     * The arm is a legal weakening, so the warning is a diagnostic and not a
     * refusal. Set this when the weakening is what was meant.
     *
     * Only `@demands` reports it. `@ensures` and `@invariant` are AND-composed, so
     * a subclass arm strengthens the obligation rather than appearing to restrict
     * it, and those decorators **refuse** the option rather than accepting one that
     * could never do anything.
     */
    allowWeakening?: boolean;

    /**
     * Allow the predicate to answer with a promise, which the lifecycle awaits
     * before it decides the arm.
     *
     * Off by default, and off is load-bearing: a `Promise` is always truthy, so
     * coercing a verdict that has not settled yet would treat a contract that has
     * not been checked as satisfied. Accepting one only where the feature's own
     * boundary is a promise keeps that rule intact — the check moves to the same
     * microtask the exit checks already occupy.
     *
     * Only an `async` method qualifies. A synchronous feature has evaluated its
     * contracts by the time a promise could settle; a generator hands the caller an
     * iterator rather than a promise; and `@invariant` runs on every accessor read
     * and write, where nothing can be awaited. Each of those refuses the option
     * where it is written, and a schema arm refuses it too because `validate` is
     * synchronous.
     *
     * A rejected predicate is a failed arm, exactly as a throwing predicate is: the
     * rejection is recorded and composition continues, so a sibling `@demands` arm
     * can still permit the call. Only a value that resolves to `true` or `false`
     * decides anything.
     *
     * The cost is a window: the instance stays reachable across one more await
     * boundary between the precondition and the body, so a concurrent caller can
     * observe it in the state the precondition just approved.
     */
    awaitPredicate?: boolean;
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
 * Rejects `awaitPredicate` on an arm that cannot answer with a promise.
 *
 * A schema's `validate` that returns a promise is refused when it runs, because
 * contract evaluation is synchronous at that point. Accepting the option on a
 * schema arm would therefore declare that waiting is in force when it is not, so
 * the mistake is refused where it is written rather than on the first call.
 */
export const assertAwaitableArm = (arm: unknown, contract: string, options: ArmOptions | undefined): void => {
    if (!options?.awaitPredicate || !isSchema(arm)) return;

    throw new TypeError(
        `${contract} cannot declare awaitPredicate on a schema arm: \`validate\` is evaluated synchronously, so `
        + 'there is no verdict to await.',
    );
}

/**
 * Rejects `awaitPredicate` on a contract whose boundaries nothing can await.
 *
 * `@invariant` is evaluated on entry and exit of every feature, on both halves of
 * an accessor, and once after construction. An accessor read has no promise for a
 * caller to await, so the option could only be honoured where it is not needed and
 * silently skipped where it is — an invisible semantic hole in the one contract
 * that is supposed to hold always. Refusing it keeps the declaration and the
 * behaviour in agreement, following `normalize` and `onViolation`.
 */
export const assertNotAwaitable = (contract: string, options: ArmOptions | undefined): void => {
    if (!options?.awaitPredicate) return;

    throw new TypeError(
        `${contract} cannot declare awaitPredicate: an invariant is evaluated after construction and on every `
        + 'accessor read and write, where there is no promise a caller could await. Declare the option on the arm '
        + 'of an `async` feature instead.',
    );
}

/**
 * Rejects a factory that is not callable.
 *
 * The return value is checked when the factory runs, because what it produces
 * depends on the violation it is given. What can be checked here is that the
 * declaration names a function at all, which catches the mistake where it is
 * written rather than on the first failed call.
 */
export const assertViolationFactory = (contract: string, options: ArmOptions | undefined): void => {
    if (options?.onViolation === undefined || typeof options.onViolation === 'function') return;

    throw new TypeError(`${contract} onViolation must be a function that returns an error object.`);
}

/**
 * Rejects a factory on a contract whose failure cannot carry one.
 *
 * `@invariant` is checked on entry, on exit, and once per construction, and its
 * failure is what tells the lifecycle that the instance is in a state a `@rescue`
 * handler must repair: `isInvariantFailure` in `Contracted.mts` recognises it as an
 * `AssertionError` whose `violation.contract` is `'@invariant'`. An error built by
 * a factory has neither, so a failure it raised would be re-tested, the factory
 * called a second time, and the first error replaced by the second. The repair
 * protocol would then act on an error the handler never saw.
 *
 * `@invariant` also has its own route to a typed error for a failure a feature
 * raises: the entry and exit checks run inside the rescuable scope, so a `@rescue`
 * handler observes the failure and can translate it. The check in `Contracted.new`
 * is outside every handler — the constructor has returned and no feature is in
 * play — so a class whose initial state violates an invariant reports an untyped
 * `AssertionError`. `@demands` has no route at all, because a rejected precondition
 * never enters a body, which is why the factory exists for it.
 */
export const assertNotViolationFactory = (contract: string, options: ArmOptions | undefined): void => {
    // Tested against `undefined` rather than for truthiness, so the same declarations
    // `assertViolationFactory` refuses are refused here too: `false`, `0`, `''`, and
    // `null` are not factories on either contract.
    if (options?.onViolation === undefined) return;

    throw new TypeError(
        `${contract} cannot declare onViolation: its failure is what signals an unrecoverable instance, `
        + 'so it must stay an AssertionError. Translate it with a `@rescue` handler instead (which does not '
        + 'cover the check in `Contracted.new`).',
    );
}

/**
 * Picks the factory that decides a contract's error.
 *
 * Scope is per contract rather than per arm, so the arms have to agree on which
 * declaration is authoritative. The **first arm evaluated** wins, matching the rule
 * that the first passing arm decides a normalized value: an arm earlier in the
 * composition is the one whose declaration the contract reads first, and an arm
 * that declares no factory defers to the next.
 *
 * @param entries - The contract's registered arms, in evaluation order.
 */
export const selectViolationFactory = (
    entries: ReadonlyArray<{ options?: ArmOptions }>,
): ViolationFactory | undefined => {
    for (const { options } of entries)
        if (options?.onViolation) return options.onViolation;

    return undefined;
}

/**
 * Rejects `allowWeakening` on a contract that never reports a weakening.
 *
 * The option suppresses a diagnostic about OR-composition, which only a
 * precondition has. On an AND-composed contract it would be a declaration record
 * that says something the runtime has no use for, discoverable only by reading the
 * source, so it is refused at the point it is written rather than silently ignored.
 *
 * This follows the rule the other options already follow: `normalize` is refused
 * where nothing can be replaced and `onViolation` where the failure must stay an
 * `AssertionError`. An option that cannot act is a mistake about which contract
 * the declaration belongs to.
 *
 * The test is for what the option would **do**, not for its presence, so
 * `allowWeakening: false` is accepted: it asks for nothing, exactly as
 * `normalize: false` is accepted on `@invariant`.
 *
 * @param contract - The contract name, for the message.
 * @param options - The declaration's options.
 * @internal
 * Exported only because the AND-composed contract modules live in their own
 * files and import it.
 */
export const assertNotWeakenable = (contract: string, options: ArmOptions | undefined): void => {
    if (!options?.allowWeakening) return;

    throw new TypeError(
        `${contract} cannot declare allowWeakening: only a precondition can be weakened, because only `
        + '`@demands` is OR-composed. A subclass arm on an AND-composed contract strengthens the obligation '
        + 'and takes effect, so there is no warning to suppress.',
    );
}

/**
 * The inherited precondition arms a class's new arm composes with.
 *
 * Read from the **metadata object's prototype**, not from
 * `metadata.demands[feature]`. At the moment a decorator runs, that property still
 * holds only what was inherited — the merged list is written afterwards — so both
 * reads agree today. The prototype is used because it is the record the compiler
 * gives each class for exactly this purpose — `Object.create(base[Symbol.metadata]
 * ?? null)` — and it keeps working if a decorator ever runs after another one has
 * already written the merged list.
 *
 * A class with no metadata of its own has a prototype of `null` and reports no
 * inherited arms, which is correct: there is nothing to have weakened.
 *
 * @param metadata - The decorating class's metadata object.
 * @param feature - The feature's name.
 * @internal
 * Exported only because `demands.mts` lives in its own file and imports it. The
 * prototype walk relies on the compiler's metadata emission, which no consumer
 * should build on.
 */
export const inheritedArms = (metadata: object | undefined, feature: unknown): readonly unknown[] => {
    const inherited = Object.getPrototypeOf(metadata ?? {}) as
        { demands?: Record<PropertyKey, readonly unknown[]> } | null;

    return (inherited?.demands as Record<PropertyKey, readonly unknown[]> | undefined)?.[feature as PropertyKey] ?? [];
}

/**
 * The features a metadata object has already been warned about.
 *
 * The diagnostic is a property of the feature, and a feature may carry several
 * arms. Each decorator runs independently, so without this a subclass declaring
 * two `@demands` arms on one method prints the same warning twice, which teaches
 * the reader to ignore it. Keyed on the metadata object because that is the object
 * the decorators share, and on the feature within it because one class may have
 * several features, each deserving its own report. A `WeakMap` so it holds nothing
 * alive.
 */
const reportedFeatures = new WeakMap<object, Set<unknown>>();

/**
 * Whether this class has already been warned about this feature, marking it if not.
 *
 * Call before reporting, not after: the pair is recorded on the first call, so a
 * class whose arms are evaluated again is not reported again.
 *
 * @param metadata - The decorating class's metadata object.
 * @param feature - The feature's name.
 * @returns Whether a report has already been made for this pair.
 * @internal
 * Exported only because `demands.mts` lives in its own file and imports it.
 */
export const alreadyReported = (metadata: object, feature: unknown): boolean => {
    const features = reportedFeatures.get(metadata);

    if (features?.has(feature)) return true;

    if (features) features.add(feature);
    else reportedFeatures.set(metadata, new Set([feature]));

    return false;
}

/**
 * Describes an inherited precondition that a new arm cannot narrow.
 *
 * A subclass declaring `@demands` reads as a restriction — "the feature now
 * requires this as well" — and it is not one. `@demands` is OR-composed, because a
 * subtype may accept wider input but never narrower, so satisfying any inherited
 * arm still permits the call and the new arm decides nothing on its own. The
 * author believes the feature is stricter than it is.
 *
 * Returns `undefined` when the arm is a genuine weakening (nothing inherited to be
 * weaker than) or when the diagnostic is switched off. It **warns** rather than
 * throws by default: a declared arm is always a legal weakening, and the defect is
 * the author's model of it, so refusing the class would break legitimate code. The
 * return value is the message so a stricter policy, or a test, can act on it.
 *
 * `@ensures` and `@invariant` are unaffected: they are AND-composed, so a subclass
 * arm genuinely strengthens the obligation and there is nothing to report. They
 * refuse `allowWeakening` outright; see {@link assertNotWeakenable}.
 *
 * @param contract - The contract name, for the message.
 * @param label - The feature, for the message.
 * @param inherited - The inherited arms this class's arm composes with.
 * @param options - The declaration's options, which may switch the diagnostic off.
 * @internal
 * Exported only because `demands.mts` lives in its own file and imports it. A
 * consumer who wants the warning suppressed sets `allowWeakening`; the message
 * text is not part of the surface.
 */
export const reportWeakeningArm = (
    contract: string,
    label: string,
    inherited: readonly unknown[],
    options: ArmOptions | undefined,
): string | undefined => {
    if (inherited.length === 0 || options?.allowWeakening) return undefined;

    const message =
        `${contract} on ${label} adds an arm to a precondition that already has ${inherited.length} inherited `
        + 'arm(s). `@demands` is OR-composed, so this arm cannot narrow what the base permits: satisfying any '
        + 'inherited arm still allows the call. Move the restriction to the base feature, or declare the arm '
        + 'with `allowWeakening` if a genuine weakening is what was meant.';

    console.warn(message);

    return message;
}

/**
 * Whether every arm is a schema, so no predicate will be shown the subject.
 *
 * A schema arm is handed the value it validates, never the predicate subject. When
 * *every* arm of a contract is a schema, the fields that exist only for a predicate
 * — `self`, `old`, `oldArgs` — cannot be observed by anything, so the work of
 * producing them is unobservable too. That is a property of the declaration rather
 * than an inference about code, which is what makes it safe to act on.
 *
 * An empty list answers `false`: a contract with no arms evaluates nothing, so there
 * is no snapshot to skip and no reason to claim otherwise.
 *
 * @param arms - The contract's registered arms, in evaluation order.
 */
export const observesNoSubject = (arms: readonly { arm: unknown }[]): boolean =>
    arms.length > 0 && arms.every(entry => isSchema(entry.arm));

/**
 * Checks one arm against the subject that belongs to it.
 *
 * @param arm - A predicate or a `StandardSchemaV1` value.
 * @param subjects - What the arm observes, chosen by the calling contract.
 * @param contract - The contract name, for the diagnostic.
 * @param label - Builds the feature's name **for a diagnostic**. A thunk because
 *   the name is a declaration read and a string concatenation that a satisfied
 *   arm never shows to anyone; see `classNameOf`.
 * @param index - The arm's position in its composition list.
 * @param options - Declaration options for this arm.
 */
export const evaluateArm = (
    arm: unknown,
    subjects: ArmSubjects,
    contract: string,
    label: () => string,
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
            options,
        );

/**
 * Checks one arm, awaiting a predicate that was declared awaitable.
 *
 * The only difference from {@link evaluateArm} is that a predicate declared
 * awaitable has its verdict awaited. Every other arm is decided synchronously, so
 * a predicate that returns a promise without the option is still refused by the
 * strict-boolean rule rather than quietly awaited — on an `async` feature as much
 * as anywhere else.
 *
 * Awaiting decides when the verdict arrives, not what it means: a rejection is a
 * failed arm with the reason in `thrown`, and a resolution that is not a boolean
 * is still a defect rather than a decision.
 */
export const evaluateArmAsync = async (
    arm: unknown,
    subjects: ArmSubjects,
    contract: string,
    label: () => string,
    index: number,
    options?: ArmOptions,
): Promise<Admissibility> => {
    if (isSchema(arm))
        return evaluateSchema(arm, subjects.schema(), contract, label, index, options);

    const predicate = arm as (...args: any[]) => unknown,
        subject = subjects.predicate();

    return options?.awaitPredicate
        ? awaitPredicate(predicate, subject, contract, label, index)
        : evaluatePredicate(predicate, subject, contract, label, index, options);
};

/**
 * Applies a predicate arm whose verdict may be a promise.
 *
 * The read-only view and the guarded call are shared with {@link evaluatePredicate}
 * through {@link invokePredicate}; only the settlement differs. A rejection is
 * caught here for the same reason a synchronous throw is caught there: an arm that
 * could not answer has not *permitted* anything, and propagating would make a
 * legal sibling arm unreachable.
 */
const awaitPredicate = async (
    predicate: (...args: any[]) => unknown,
    subject: PredicateSubject,
    contract: string,
    label: () => string,
    index: number,
): Promise<Admissibility> => {
    let verdict: unknown;

    try {
        verdict = await invokePredicate(predicate, subject);
    } catch (thrown) {
        return { ok: false, thrown };
    }

    return { ok: assertContractResult(verdict, contract, label, index) };
}

/**
 * Calls a predicate with the guarded subject.
 *
 * The synchronously evaluated arm and the awaited one must observe the same
 * thing — the read-only view of `self`, and every other field untouched — so the
 * call is made in one place. Two copies would be free to disagree about which
 * fields are guarded.
 */
const invokePredicate = (predicate: (...args: any[]) => unknown, subject: PredicateSubject): unknown => {
    // Only `self` is guarded, and the guard is a property of the field rather
    // than of its position. Every other field describes the invocation rather
    // than the instance: `args` and `result` are readable data shared with the
    // caller, `old` is a detached copy taken by `populateOld`, and `error` and
    // `retry` belong to `@rescue`, which is exempt from the view because
    // restoring corrupted state is its purpose.
    //
    // The guarded subject is built with one spread and an override rather than by
    // destructuring `self` out and spreading the remainder: the two produce the same
    // object, and the rest half of a destructuring pattern re-enumerates every key
    // into a second object for no gain.
    return predicate(typeof subject.self === 'object' && subject.self !== null
        ? { ...subject, self: readOnlyView(subject.self) }
        : subject);
}

/**
 * Applies a predicate arm, reusing the strict-boolean rule from #283.
 *
 * Reusing `assertContractResult` keeps the diagnostic identical whether the
 * predicate was declared on its own or alongside a schema.
 *
 * The instance is passed as a read-only view through {@link invokePredicate}. A
 * predicate answers a question, so it must not be able to change the state it is
 * asked about — see `read-only.mts` for why this is a scoped proxy rather than
 * `Object.freeze`. The view is applied at the call rather than by the caller so
 * that a predicate can never be invoked with the raw target by mistake.
 */
const evaluatePredicate = (
    predicate: (...args: any[]) => unknown,
    subject: PredicateSubject,
    contract: string,
    label: () => string,
    index: number,
    options: ArmOptions | undefined,
): Admissibility => {
    // A predicate that throws has answered "no": the call it guards must not be
    // denied on its say-so when a sibling arm permits it. The value is carried in
    // `thrown` rather than propagated, so the contract can decide whether it still
    // matters once every arm has been evaluated.
    let verdict: unknown;

    try {
        verdict = invokePredicate(predicate, subject);
    } catch (thrown) {
        return { ok: false, thrown };
    }

    // The arm may declare `awaitPredicate` on a feature that is not `async`: a
    // subclass can override an async feature with a synchronous one while the
    // metadata record still carries the inherited arm. Nothing at this boundary can
    // wait, so the verdict is named for what it is rather than reported as a
    // predicate that forgot to return a boolean.
    if (options?.awaitPredicate && typeof (verdict as { then?: unknown } | null)?.then === 'function')
        throw new TypeError(
            `${contract} predicate #${index + 1} for ${label()} declared awaitPredicate but returned a Promise, `
            + 'and the feature it guards is not `async`, so nothing can await it. Declare the feature `async`, '
            + 'or drop the option.',
        );

    // The verdict is validated outside the guard, because a non-boolean return is a
    // defect in the predicate rather than a decision about the call: a Promise is
    // truthy, so treating it as a failed arm would let a sibling excuse a contract
    // that never ran. That is the rule `assertContractResult` exists to enforce, and
    // it stays fatal.
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
    label: () => string,
    index: number,
    options: ArmOptions | undefined,
): Admissibility => {
    const result = schema['~standard'].validate(subject) as any;

    if (typeof result?.then === 'function')
        throw new TypeError(
            `${contract} schema #${index + 1} for ${label()} returned a Promise; `
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
 * A failure record that is allocated only once an arm rejects.
 *
 * A satisfied composition is the common case, and it would otherwise allocate three
 * arrays it never reads. The log hands back the same interface as {@link ArmFailures},
 * so the composition loops keep their rule rather than their bookkeeping, and
 * `entries` stays `undefined` until something fails — which is the whole test a loop
 * needs at the end.
 *
 * The methods live on the prototype rather than in a closure per call, because a
 * closure pair allocated on every invocation costs more than the three arrays it is
 * there to avoid.
 */
export class FailureLog {
    #entries: ArmFailures | undefined;

    /** Records a rejected arm, allocating the record on the first one. */
    record(index: number, result: Admissibility): void {
        recordFailure(this.#entries ??= armFailures(), index, result);
    }

    /** The record, or `undefined` when no arm has rejected. */
    get entries(): ArmFailures | undefined { return this.#entries; }
}

/** Starts a failure log that allocates its record only when something fails. */
export const failureLog = (): FailureLog => new FailureLog();

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
