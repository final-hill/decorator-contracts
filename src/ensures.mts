import { violationFailure } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import { assertFeatureContractTarget } from './decorator.mjs';
import {
    armFailures, assertNormalizable, assertViolationFactory, describeArm, evaluateArm,
    recordFailure, selectViolationFactory, type ArmOptions,
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
 */
export type EnsuresArm<
    This extends Contracted,
    Args extends any[] = any[],
    Result = unknown,
> = EnsuresPredicate<This, Args, Result> | StandardSchemaV1<unknown, any>;

export type EnsuresDecorator = <
    This extends Contracted,
    Args extends any[],
    Result = unknown,
>(
    arm: EnsuresArm<This, Args, Result>,
    options?: ArmOptions,
) => (
    value: unknown,
    context: FeatureDecoratorContext<This, Args>
) => void;

/** A registered postcondition arm, with the options it was declared with. */
/** No arms are declared for a feature, so none are evaluated. */
const NO_ARMS: readonly RegisteredEnsures[] = Object.freeze([]);

export interface RegisteredEnsures {
    arm: EnsuresArm<Contracted>;
    options?: ArmOptions;
}

export const ensures: EnsuresDecorator = (arm, options) => (feature, ctx) => {
    assertFeatureContractTarget('@ensures', feature, ctx);
    assertNormalizable(arm, '@ensures', options);
    assertViolationFactory('@ensures', options);

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
    if (!Contracted[checkedMode]) return result;

    const Class = instance.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[propertyKey] ?? NO_ARMS;

    if (es.length === 0) return result;

    const label = `${instance.constructor.name}.${String(propertyKey)}`,
        failures = armFailures();

    let normalized = result;

    // ALL arms must hold for the obligation to be fulfilled.
    for (const [index, entry] of es.entries()) {
        const outcome = evaluateArm(
            entry.arm,
            // A predicate sees the invocation, the historical instance, and the
            // result; a schema validates the result. Every arm is given the same
            // `result`, including a normalizing schema arm, which validates it
            // before replacing it. Supplying the raw value to all of them is what
            // makes AND-composition a claim about one thing rather than several.
            {
                predicate: () => ({ self: instance, args, old, result }),
                schema: () => result,
            },
            '@ensures',
            label,
            index,
            entry.options,
        );

        // One failing arm rejects the call, but its siblings are still evaluated:
        // the caller learns about every broken postcondition rather than the first.
        if (!outcome.ok) {
            recordFailure(failures, index, outcome);

            continue;
        }

        if (outcome.value !== undefined) normalized = outcome.value;
    }

    if (failures.failed.length === 0) return normalized;

    throw violationFailure(
        '@ensures',
        instance.constructor.name,
        String(propertyKey),
        es.map(entry => entry.arm),
        failures,
        'A postcondition was not satisfied after the feature ran.',
        describeArm,
        selectViolationFactory(es),
    );
}
