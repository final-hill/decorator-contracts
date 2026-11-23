import { violationFailure } from './assert.mjs';
import { contractsEnabled, Contracted } from './Contracted.mjs';
import { classNameOf } from './name.mjs';
import { assertAwaitableFeature, assertFeatureContractTarget } from './decorator.mjs';
import {
    failureLog, assertAwaitableArm, assertNormalizable, assertNotWeakenable, assertViolationFactory, describeArm,
    evaluateArm, evaluateArmAsync, selectViolationFactory, type ArmFailures,
    type Admissibility, type ArmOptions, type ArmSubjects, type FailureLog,
} from './admissibility.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * The fields a postcondition predicate is called with.
 *
 * `old` is the snapshot of the instance from before the feature ran. It is not
 * `Readonly`, and is deliberately not the same object as `self`: it is a detached
 * copy, so a predicate writing to it corrupts nothing.
 *
 * `oldArgs` is the snapshot of the **call's arguments** from before the body ran,
 * taken on the same terms as `old`. It is what lets a predicate state a property
 * over an object it was *given*, rather than only over the instance whose feature
 * it is: `oldArgs[0].onHold` is the argument's state before the call, while
 * `args[0].onHold` is its state now.
 *
 * `oldArgs` mirrors the arguments the caller supplied, which is why a getter has
 * none: `args` describes a getter's *result*, and a result has no pre-state. A
 * generator is the same case from the other end — `args` describes the value the
 * step yielded — so it has none either. Every other feature pairs them:
 * `oldArgs[i]` is the pre-state of `args[i]`.
 *
 * The field is typed `Args` because that is the only tuple the subject carries.
 * A generator's `oldArgs` is therefore empty where its annotation says otherwise,
 * which is why a generator's `@ensures` is annotated for its `args` alone.
 *
 * `result` is the value the feature body produced, which is what the caller
 * receives unless a schema arm normalizes it. Every arm is given the **same**
 * unnormalized value, because `@ensures` is AND-composed: "every arm must hold" is
 * only a statement about one thing if every arm observes one thing. A normalizing
 * schema also validates this value and replaces it afterwards, so a predicate and
 * a schema in the same composition always agree about what they were shown.
 *
 * See `DemandsSubject` for why `self` is not `Readonly<This>` and for the
 * inference that makes an annotation unnecessary.
 *
 * `Result` defaults to `unknown`. A method's context type carries a call
 * signature while a getter's carries the property type, so both would be
 * inference sites for one parameter and the compiler would resolve it to their
 * intersection. A predicate that reads a member of `result` therefore names it —
 * `EnsuresSubject<Cart, [number], number>` — and `unknown` rather than `any` makes
 * forgetting that a compile error rather than a silent `undefined`.
 */
export interface EnsuresSubject<This, Args extends any[] = any[], Result = unknown> {
    readonly self: This;
    readonly args: Args;
    readonly old: This;
    readonly oldArgs: Args;
    readonly result: Result;
}

/**
 * A postcondition predicate.
 *
 * It takes one object rather than a positional list, so a contract that supplies
 * fields the predicate does not read costs nothing where it is declared.
 */
export type EnsuresPredicate<
    This extends Contracted,
    Args extends any[] = any[],
    Result = unknown,
> = (subject: EnsuresSubject<This, Args, Result>) => boolean;

/**
 * A postcondition arm: a predicate, or a schema the feature's **result** must
 * satisfy.
 *
 * A schema validates the result, which is the value the caller receives. This is
 * the covariant position: a subtype may promise a narrower result, so the arms
 * are AND-composed.
 *
 * A predicate may answer with a promise only when the declaration sets
 * {@link ArmOptions.awaitPredicate}; the overload on `EnsuresDecorator` is what
 * refuses the asynchronous form without it.
 */
export type EnsuresArm<
    This extends Contracted,
    Args extends any[] = any[],
    Result = unknown,
> =
    EnsuresPredicate<This, Args, Result>
    | ((subject: EnsuresSubject<This, Args, Result>) => boolean | Promise<boolean>)
    | StandardSchemaV1<unknown, any>;

/**
 * The `@ensures` decorator.
 *
 * The two overloads are the opt-in, as on `@demands`: a promise is admitted only
 * by the second, which requires `awaitPredicate: true`, while the first keeps the
 * synchronous verdict or a schema and accepts an options object built separately.
 */
export type EnsuresDecorator = {
    <
        This extends Contracted,
        Args extends any[],
        Result = unknown,
    >(
        arm: EnsuresPredicate<This, Args, Result> | StandardSchemaV1<unknown, any>,
        options?: ArmOptions,
    ): (
        value: unknown,
        context: FeatureDecoratorContext<This, Args>
    ) => void;
    <
        This extends Contracted,
        Args extends any[],
        Result = unknown,
    >(
        arm: EnsuresArm<This, Args, Result>,
        options: ArmOptions & { awaitPredicate: true },
    ): (
        value: unknown,
        context: FeatureDecoratorContext<This, Args>
    ) => void;
};

/** A registered postcondition arm, with the options it was declared with. */
/** No arms are declared for a feature, so none are evaluated. */
const NO_ARMS: readonly RegisteredEnsures[] = Object.freeze([]);

export interface RegisteredEnsures {
    arm: EnsuresArm<Contracted>;
    options?: ArmOptions;
}

export const ensures: EnsuresDecorator = (arm, options) => (feature, ctx) => {
    assertFeatureContractTarget('@ensures', feature, ctx);
    assertAwaitableFeature('@ensures', feature, ctx, options);
    assertAwaitableArm(arm, '@ensures', options);
    assertNormalizable(arm, '@ensures', options);
    assertViolationFactory('@ensures', options);
    assertNotWeakenable('@ensures', options);

    // See `@demands` for why the metadata record needs an assertion here.
    const es = [
        ...(ctx.metadata as any)?.ensures?.[ctx.name] ?? [],
        { arm, options }
    ]

    // AND-composition means every arm must hold, so two arms that both replace
    // the result would disagree about what the caller receives. There is no
    // correct winner, so the declaration is rejected where it is written.
    const normalizers = (es as unknown as RegisteredEnsures[]).filter(entry => entry.options?.normalize);

    if (normalizers.length > 1)
        throw new TypeError(
            `@ensures for ${String(ctx.name)} declares ${normalizers.length} normalizing arms; `
            + 'at most one arm may normalize the result, because they would disagree about what the caller receives.',
        );

    ctx.metadata.ensures = {
        ...(ctx.metadata?.ensures ?? {}),
        [ctx.name]: es
    };
}

/**
 * What a postcondition arm observes.
 *
 * A predicate sees the invocation, the historical instance, the invocation's
 * historical arguments, and the result; a schema validates the result. Every arm is
 * given the same `result`, including a normalizing schema arm, which validates it
 * before replacing it. Supplying the raw value to all of them is what makes
 * AND-composition a claim about one thing rather than several.
 *
 * `oldArgs` arrives on the subject rather than as a parameter because the subject is
 * where a predicate reads it, and because this function is published: a caller that
 * builds a subject already supplies it, and its signature stays as it was.
 */
const ensuresSubjects = (
    instance: Contracted,
    args: any[],
    old: Contracted,
    oldArgs: any[],
    result: unknown,
): ArmSubjects => ({
    predicate: () => ({ self: instance, args, old, oldArgs, result }),
    schema: () => result,
});

/**
 * Raises the failure for a postcondition the arms did not all satisfy.
 *
 * A declared factory decides the error; failing that, a thrown value is raised in
 * place of the `AssertionError`, so a typed error survives.
 */
function raiseEnsuresFailure(
    es: readonly RegisteredEnsures[],
    className: string,
    propertyKey: PropertyKey,
    failures: ArmFailures,
): never {
    throw violationFailure(
        '@ensures',
        className,
        String(propertyKey),
        es.map(entry => entry.arm),
        failures,
        'A postcondition was not satisfied after the feature ran.',
        describeArm,
        selectViolationFactory(es),
    );
}

/**
 * Folds one arm's outcome into the composition's running result.
 *
 * A rejected arm is recorded and the running value passes through unchanged; a
 * passing arm replaces it only when it normalized one, which is how a schema arm's
 * `Output` reaches the caller. The rule is the same whether the verdict was
 * synchronous or awaited, so it is stated once for both loops.
 */
const foldOutcome = (
    failures: FailureLog,
    index: number,
    outcome: Admissibility,
    normalized: unknown,
): unknown => {
    if (!outcome.ok) {
        failures.record(index, outcome);

        return normalized;
    }

    return outcome.value === undefined ? normalized : outcome.value;
}

/**
 * Evaluates the postcondition for an invocation.
 *
 * The arms are AND-composed, which is the covariance rule: a subtype may
 * strengthen a postcondition, so every inherited arm has to keep holding.
 *
 * @param result - The value the caller receives. A schema arm validates it.
 * @param oldArgs - The pre-state of the arguments the body received. Optional and
 *   trailing so the signature stays additive: a caller that predates the field
 *   omits it, and the subject reports an empty list.
 * @returns The result to hand the caller, which is the original unless an arm
 *   normalized it.
 */
export function assertEnsures(
    instance: Contracted,
    old: Contracted,
    propertyKey: PropertyKey,
    args: any[],
    result: unknown,
    oldArgs: any[] = [],
    enabled: boolean = contractsEnabled(instance.constructor),
): unknown {
    if (!enabled) return result;

    const Class = instance.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[propertyKey] ?? NO_ARMS;

    if (es.length === 0) return result;

    const label = () => `${classNameOf(Class)}.${String(propertyKey)}`;

    const failures = failureLog();

    let normalized = result;

    // ALL arms must hold for the obligation to be fulfilled.
    for (let index = 0; index < es.length; index++) {
        const entry = es[index];

        normalized = foldOutcome(failures, index, evaluateArm(
            entry.arm,
            ensuresSubjects(instance, args, old, oldArgs, result),
            '@ensures',
            label,
            index,
            entry.options,
        ), normalized);
    }

    if (failures.entries === undefined) return normalized;

    raiseEnsuresFailure(es, classNameOf(Class), propertyKey, failures.entries);
}

/**
 * Whether any registered arm declared `awaitPredicate`.
 *
 * The asynchronous lifecycle asks this before choosing the awaited composition, so
 * a feature whose arms are all synchronous pays nothing for the capability: the
 * awaited form returns a promise from every call, which is one extra microtask the
 * caller would wait on for a verdict that was already decided synchronously.
 *
 * @param instance - The instance whose class holds the record.
 * @param propertyKey - The feature being invoked.
 * @internal
 * Exported only so the lifecycle in `Contracted.mts` can import it; `index.mts`
 * does not re-export it.
 */
export function ensuresAwaitable(instance: Contracted, propertyKey: PropertyKey): boolean {
    const Class = instance.constructor as typeof Contracted;

    return (Class[Symbol.metadata]?.ensures?.[propertyKey] ?? NO_ARMS).some(entry => entry.options?.awaitPredicate);
}

/**
 * Evaluates the postcondition for an invocation whose arms may answer with a promise.
 *
 * AND-composition decides the arms here too: a subtype may strengthen a
 * postcondition, so every arm has to hold. Only the settlement differs. A
 * rejected predicate is a failed arm, exactly as a throwing one is, and the
 * rejection is raised only when every arm has been evaluated and at least one
 * failed.
 *
 * @param result - The value the caller receives. A schema arm validates it.
 * @param oldArgs - The pre-state of the arguments the body received. Optional and
 *   trailing so the signature stays additive: a caller that predates the field
 *   omits it, and the subject reports an empty list.
 * @returns The result to hand the caller, which is the original unless an arm
 *   normalized it.
 */
export async function assertEnsuresAsync(
    instance: Contracted,
    old: Contracted,
    propertyKey: PropertyKey,
    args: any[],
    result: unknown,
    oldArgs: any[] = [],
    enabled: boolean = contractsEnabled(instance.constructor),
): Promise<unknown> {
    if (!enabled) return result;

    const Class = instance.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[propertyKey] ?? NO_ARMS;

    if (es.length === 0) return result;

    const label = () => `${classNameOf(Class)}.${String(propertyKey)}`,
        failures = failureLog();

    let normalized = result;

    for (let index = 0; index < es.length; index++) {
        const entry = es[index];

        normalized = foldOutcome(failures, index, await evaluateArmAsync(
            entry.arm,
            ensuresSubjects(instance, args, old, oldArgs, result),
            '@ensures',
            label,
            index,
            entry.options,
        ), normalized);
    }

    if (failures.entries === undefined) return normalized;

    raiseEnsuresFailure(es, classNameOf(Class), propertyKey, failures.entries);
}
