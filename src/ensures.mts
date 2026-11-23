import { violationFailure } from './assert.mjs';
import { contractsEnabled, Contracted } from './Contracted.mjs';
import { classNameOf } from './name.mjs';
import { assertAwaitableFeature, assertFeatureContractTarget } from './decorator.mjs';
import {
    armFailures, assertAwaitableArm, assertNormalizable, assertNotWeakenable, assertViolationFactory, describeArm,
    evaluateArm, evaluateArmAsync, recordFailure, selectViolationFactory, type Admissibility, type ArmFailures,
    type ArmOptions, type ArmSubjects,
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
 * A predicate sees the invocation, the historical instance, and the result; a
 * schema validates the result. Every arm is given the same `result`, including a
 * normalizing schema arm, which validates it before replacing it. Supplying the raw
 * value to all of them is what makes AND-composition a claim about one thing rather
 * than several.
 */
const ensuresSubjects = (instance: Contracted, args: any[], old: Contracted, result: unknown): ArmSubjects => ({
    predicate: () => ({ self: instance, args, old, result }),
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
 * Every arm is evaluated even after one rejects, so a failed arm is recorded and
the running value passes through unchanged. A passing arm replaces the value only
when it normalized one, which is how a schema arm's `Output` reaches the caller.
 *
 * The decision is the same whether the verdict was synchronous or awaited, so it is
 * stated once for both loops. It is also the part a reader has to get right: the
`result` a predicate was shown is not the `result` a later arm sees.
 */
const foldOutcome = (
    failures: ArmFailures,
    index: number,
    outcome: Admissibility,
    normalized: unknown,
): unknown => {
    if (!outcome.ok) {
        recordFailure(failures, index, outcome);

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
 * @returns The result to hand the caller, which is the original unless an arm
 *   normalized it.
 */
export function assertEnsures(
    instance: Contracted,
    old: Contracted,
    propertyKey: PropertyKey,
    args: any[],
    result: unknown,
): unknown {
    const Class = instance.constructor as typeof Contracted;

    if (!contractsEnabled(Class)) return result;

    const es = Class[Symbol.metadata]?.ensures?.[propertyKey] ?? NO_ARMS;

    if (es.length === 0) return result;

    const className = classNameOf(Class),
        label = `${className}.${String(propertyKey)}`,
        failures = armFailures();

    let normalized = result;

    // ALL arms must hold for the obligation to be fulfilled.
    for (const [index, entry] of es.entries())
        normalized = foldOutcome(failures, index, evaluateArm(
            entry.arm,
            ensuresSubjects(instance, args, old, result),
            '@ensures',
            label,
            index,
            entry.options,
        ), normalized);

    if (failures.failed.length === 0) return normalized;

    raiseEnsuresFailure(es, className, propertyKey, failures);
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
 * @returns The result to hand the caller, which is the original unless an arm
 *   normalized it.
 */
export async function assertEnsuresAsync(
    instance: Contracted,
    old: Contracted,
    propertyKey: PropertyKey,
    args: any[],
    result: unknown,
): Promise<unknown> {
    const Class = instance.constructor as typeof Contracted;

    if (!contractsEnabled(Class)) return result;

    const es = Class[Symbol.metadata]?.ensures?.[propertyKey] ?? NO_ARMS;

    if (es.length === 0) return result;

    const className = classNameOf(Class),
        label = `${className}.${String(propertyKey)}`,
        failures = armFailures();

    let normalized = result;

    for (const [index, entry] of es.entries())
        normalized = foldOutcome(failures, index, await evaluateArmAsync(
            entry.arm,
            ensuresSubjects(instance, args, old, result),
            '@ensures',
            label,
            index,
            entry.options,
        ), normalized);

    if (failures.failed.length === 0) return normalized;

    raiseEnsuresFailure(es, className, propertyKey, failures);
}
