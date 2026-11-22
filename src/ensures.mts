import { violationFailure } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import { assertFeatureContractTarget } from './decorator.mjs';
import { armFailures, assertNormalizable, describeArm, evaluateArm, recordFailure, type ArmOptions } from './admissibility.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * A postcondition predicate.
 *
 * `args` is the argument list of the invocation and `old` is the snapshot of
 * the instance from before the feature ran, so a predicate reads
 * `(self, [x], old, result) => ...`. See `DemandsPredicate` for why the tuple is
 * generic.
 *
 * `result` is the value the feature body produced, which is what the caller
 * receives unless a schema arm normalizes it. Every arm is given the **same**
 * unnormalized value, because `@ensures` is AND-composed: "every arm must hold" is
 * only a statement about one thing if every arm observes one thing. A normalizing
 * schema also validates this value and replaces it afterwards, so a predicate and
 * a schema in the same composition always agree about what they were shown.
 */
export type EnsuresPredicate<This extends Contracted, Args extends any[] = any[]> =
    (self: This, args: Args, old: This, result: unknown) => boolean;

/**
 * A postcondition arm: a predicate, or a schema the feature's **result** must
 * satisfy.
 *
 * A schema validates the result, which is the value the caller receives. This is
 * the covariant position: a subtype may promise a narrower result, so the arms
 * are AND-composed.
 */
export type EnsuresArm<This extends Contracted, Args extends any[] = any[]> =
    EnsuresPredicate<This, Args> | StandardSchemaV1<unknown, any>;

export type EnsuresDecorator = <
    This extends Contracted,
    Args extends any[]
>(
    arm: EnsuresArm<This, Args>,
    options?: ArmOptions,
) => (
    value: unknown,
    context: FeatureDecoratorContext
) => void;

/** A registered postcondition arm, with the options it was declared with. */
export interface RegisteredEnsures {
    arm: EnsuresArm<Contracted>;
    options?: ArmOptions;
}

export const ensures: EnsuresDecorator = (arm, options) => (feature, ctx) => {
    assertFeatureContractTarget('@ensures', feature, ctx);
    assertNormalizable(arm, '@ensures', options);

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
        es = (Class[Symbol.metadata]?.ensures?.[propertyKey] ?? []) as unknown as RegisteredEnsures[];

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
                predicate: () => [instance, args, old, result],
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
    );
}
