import { violationError } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import { assertFeatureContractTarget } from './decorator.mjs';
import { assertNormalizable, describeArm, evaluateArm, type ArmOptions } from './admissibility.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * A postcondition predicate.
 *
 * `args` is the argument list of the invocation and `old` is the snapshot of
 * the instance from before the feature ran, so a predicate reads
 * `(self, [x], old) => ...`. See `DemandsPredicate` for why the tuple is generic.
 */
export type EnsuresPredicate<This extends Contracted, Args extends any[] = any[]> =
    (self: This, args: Args, old: This) => boolean;

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
        failed: number[] = [],
        issues: StandardSchemaV1.Issue[] = [];

    let normalized = result;

    // ALL arms must hold for the obligation to be fulfilled.
    for (const [index, entry] of es.entries()) {
        const outcome = evaluateArm(
            entry.arm,
            // A predicate sees the invocation and the historical instance; a
            // schema validates the result. Both are supplied so the adapter can
            // pick the one that belongs to the arm.
            {
                predicate: () => [instance, args, old],
                schema: () => result,
            },
            '@ensures',
            label,
            index,
            entry.options,
        );

        if (!outcome.ok) {
            failed.push(index);

            if (outcome.issues) issues.push(...outcome.issues);

            continue;
        }

        if (outcome.value !== undefined) normalized = outcome.value;
    }

    if (failed.length === 0) return normalized;

    throw violationError(
        '@ensures',
        instance.constructor.name,
        String(propertyKey),
        es.map(entry => entry.arm),
        failed,
        'A postcondition was not satisfied after the feature ran.',
        issues,
        describeArm,
    );
}
