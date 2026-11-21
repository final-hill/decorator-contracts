import { assert, assertContractResult, violationError } from './assert.mjs';
import { checkedMode, Contracted } from "./Contracted.mjs";
import { assertFeatureContractTarget } from './decorator.mjs';
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

export type DemandsDecorator = <This extends Contracted, Args extends any[], Feature = unknown>(
    predicate: (self: This, args: Args) => boolean
) => (
    value: Feature,
    context: FeatureDecoratorContext
) => Feature | void;

export const demands: DemandsDecorator = (predicate) => (feature, ctx) => {
    assertFeatureContractTarget('@demands', feature, ctx);

    const ds = [
        ...(ctx.metadata as any)?.demands?.[ctx.name] ?? [],
        predicate
    ]

    ctx.metadata.demands = {
        ...(ctx.metadata?.demands ?? {}),
        [ctx.name]: ds
    };

    ctx.addInitializer(function () {
        assert(this instanceof Contracted, '@demands decorator can only be applied to classes that extend Contracted');
    })
}

export function assertDemands(instance: Contracted, propertyKey: PropertyKey, ...args: any[]) {
    if (!Contracted[checkedMode]) return;

    const Class = instance.constructor as typeof Contracted,
        ds = Class[Symbol.metadata]?.demands?.[propertyKey] ?? [] as DemandsPredicate<Contracted>[];

    if (ds.length === 0) return;

    const label = `${instance.constructor.name}.${String(propertyKey)}`;

    // If ANY demand is true then the obligation is considered fulfilled
    for (const [index, d] of ds.entries())
        if (assertContractResult(d(instance, args), '@demands', label, index)) return;

    // If we reach here, it means all demands were false. Every arm is reported,
    // because OR-composition means any of them could have permitted the call.
    throw violationError(
        '@demands',
        instance.constructor.name,
        String(propertyKey),
        ds,
        ds.map((_, index) => index),
        'A precondition was not satisfied, so the feature was not entered.',
    );
}