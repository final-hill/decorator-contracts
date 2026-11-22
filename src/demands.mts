import { violationFailure } from './assert.mjs';
import { checkedMode, Contracted } from "./Contracted.mjs";
import { assertFeatureContractTarget } from './decorator.mjs';
import { armFailures, assertNormalizable, describeArm, evaluateArm, recordFailure, type ArmOptions } from './admissibility.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * The fields a precondition predicate is called with.
 *
 * `self` is the instance and `args` is the invocation's argument list.
 *
 * `This` and `Args` are inferred from the member the decorator is applied to, so
 * a predicate that reads instance state needs no annotation:
 * `({ self, args }) => self._x > 0`. The inference comes from the decorator's
 * context type, which carries the class and the feature's signature; naming it
 * explicitly is only necessary where the runtime subject differs from that
 * signature.
 *
 * `self` is **not** `Readonly<This>`. `Readonly` maps over `keyof This`, which
 * covers only public members, so `Readonly<Cart>` has no `_balance` when
 * `_balance` is `protected` — the type would erase the fields contracts are
 * written against, and `protected` state is the documented convention. Purity is
 * enforced at runtime instead: every predicate receives a read-only view, so an
 * assignment throws rather than silently corrupting the instance the next
 * contract observes.
 */
export interface DemandsSubject<This, Args extends any[] = any[]> {
    readonly self: This;
    readonly args: Args;
}

/**
 * A precondition predicate.
 *
 * `args` is the argument list of the invocation, matching `EnsuresPredicate`,
 * so a predicate destructures it: `({ args: [x] }) => x > 0`.
 *
 * The type is generic over the argument tuple so the element types are inferred
 * from the predicate. Writing `({ args }) => args > 0` does not compile: `args`
 * is the array, not the first argument, and a predicate that compares against the
 * array passes only through coercion.
 *
 * It takes one object rather than a positional list, so a contract that supplies
 * a field the predicate does not read costs nothing where it is declared.
 */
export type DemandsPredicate<This extends Contracted, Args extends any[] = any[]> =
    (subject: DemandsSubject<This, Args>) => boolean;

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

export type DemandsDecorator = <This extends Contracted, Args extends any[]>(
    arm: DemandsArm<This, Args>,
    options?: ArmOptions,
) => (
    value: unknown,
    context: FeatureDecoratorContext<This, Args>
) => void;

/** No arm is declared for a feature, so none is evaluated. */
const NO_ARMS: readonly RegisteredDemands[] = Object.freeze([]);

/** A registered precondition arm, with the options it was declared with. */
export interface RegisteredDemands {
    arm: DemandsArm<Contracted>;
    options?: ArmOptions;
}

export const demands: DemandsDecorator = (arm, options) => (feature, ctx) => {
    assertFeatureContractTarget('@demands', feature, ctx);
    assertNormalizable(arm, '@demands', options);

    // The cast is the protocol's, not this contract's: `ctx.metadata` is
    // `DecoratorMetadataObject`, an open `Record<PropertyKey, unknown>`, so the
    // key this decorator writes has no static type until it is asserted. The
    // record's shape is asserted once here and read back through
    // `Contracted[Symbol.metadata]`, which is typed.
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
        ds = Class[Symbol.metadata]?.demands?.[propertyKey] ?? NO_ARMS;

    if (ds.length === 0) return args;

    const label = `${instance.constructor.name}.${String(propertyKey)}`,
        failures = armFailures();

    for (const [index, { arm, options }] of ds.entries()) {
        const result = evaluateArm(
            arm,
            { predicate: () => ({ self: instance, args }), schema: () => args },
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
