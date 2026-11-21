import { violationFailure } from './assert.mjs';
import { checkedMode, Contracted } from "./Contracted.mjs";
import { assertFeatureContractTarget } from './decorator.mjs';
import { armFailures, assertNormalizable, describeArm, evaluateArm, recordFailure, type ArmOptions } from './admissibility.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * A precondition predicate.
 *
 * `args` is the argument list of the invocation, matching `EnsuresPredicate`,
 * so a predicate destructures it: `(_self, [x]) => x > 0`.
 *
 * The type is generic over the argument tuple so the element types are inferred
 * from the predicate. Writing `(_self, x: number) => x > 0` does not compile:
 * the second parameter is the array, not the first argument, and a predicate
 * that compares against the array passes only through coercion, which is how
 * the previous documentation ended up describing contracts that never held.
 */
export type DemandsPredicate<This extends Contracted, Args extends any[] = any[]> =
    (self: This, args: Args) => boolean;

/**
 * A precondiction arm: a predicate, or a schema the argument tuple must satisfy.
 *
 * A schema validates the **argument tuple**, which is the subject `@demands`
 * already describes, so a method with two parameters is written as
 * `z.tuple([A, B])`. Keeping one subject for both kinds of arm is what lets the
 * composition rule below be the same for both.
 *
 * The schema's `Input` is left unpinned (`unknown`) rather than constrained to
 * `any[]`, because every real provider declares a concrete input type and
 * `StandardSchemaV1` is invariant in it: pinning it here would reject a
 * `z.tuple([...])` whose input is `[number, number]`. The tuple shape is an
 * obligation on the declaration, checked at runtime by the schema itself.
 */
export type DemandsArm<This extends Contracted, Args extends any[] = any[]> =
    DemandsPredicate<This, Args> | StandardSchemaV1<unknown, any>;

export type DemandsDecorator = <This extends Contracted, Args extends any[], Feature = unknown>(
    arm: DemandsArm<This, Args>,
    options?: ArmOptions,
) => (
    value: Feature,
    context: FeatureDecoratorContext
) => Feature | void;

/** A registered precondition arm, with the options it was declared with. */
export interface RegisteredDemands {
    arm: DemandsArm<Contracted>;
    options?: ArmOptions;
}

export const demands: DemandsDecorator = (arm, options) => (feature, ctx) => {
    assertFeatureContractTarget('@demands', feature, ctx);
    assertNormalizable(arm, '@demands', options);

    const ds = [
        ...(ctx.metadata as any)?.demands?.[ctx.name] ?? [],
        { arm, options }
    ]

    ctx.metadata.demands = {
        ...(ctx.metadata?.demands ?? {}),
        [ctx.name]: ds
    };
}

/**
 * Evaluates the precondition for an invocation.
 *
 * The arms are OR-composed, which is the contravariance rule: a subtype may
 * weaken a precondition, so satisfying any inherited arm is enough. A schema arm
 * composes exactly like a predicate arm.
 *
 * When an arm asks for normalization, the value it produced replaces the
 * arguments, and because OR-composition short-circuits, the **first passing arm**
 * decides what that value is. That is deterministic and matches evaluation order.
 *
 * @returns The arguments to use, which are the originals unless an arm
 *   normalized them.
 */
export function assertDemands(
    instance: Contracted,
    propertyKey: PropertyKey,
    args: any[],
): any[] {
    if (!Contracted[checkedMode]) return args;

    const Class = instance.constructor as typeof Contracted,
        ds = (Class[Symbol.metadata]?.demands?.[propertyKey] ?? []) as unknown as RegisteredDemands[];

    if (ds.length === 0) return args;

    const label = `${instance.constructor.name}.${String(propertyKey)}`,
        failures = armFailures();

    for (const [index, { arm, options }] of ds.entries()) {
        const result = evaluateArm(
            arm,
            { predicate: () => [instance, args], schema: () => args },
            '@demands',
            label,
            index,
            options,
        );

        // A later arm may still permit the call, so a rejected arm is recorded
        // rather than returned from. Propagating a throw here would make a legal
        // weakening arm unreachable.
        if (!result.ok) {
            recordFailure(failures, index, result);

            continue;
        }

        // Any satisfied arm fulfils the obligation.
        return result.value === undefined ? args : result.value as any[];
    }

    // Every arm failed. All of them are reported, because OR-composition means
    // any of them could have permitted the call. A thrown value is raised in place
    // of the AssertionError when there is one, so a typed error survives.
    throw violationFailure(
        '@demands',
        instance.constructor.name,
        String(propertyKey),
        ds.map(entry => entry.arm),
        failures,
        'A precondition was not satisfied, so the feature was not entered.',
        describeArm,
    );
}
