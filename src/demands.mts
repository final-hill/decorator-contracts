import { assert, assertContractResult } from './assert.mjs';
import { checkedMode, Contracted } from "./Contracted.mjs";
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

export const demands: DemandsDecorator = (predicate) => (_feature, ctx) => {
    assert(["method", "getter", "setter"].includes(ctx.kind), '@demands decorator can only be applied to methods, getters, or setters');
    assert(ctx.static === false, '@demands decorator cannot be applied to static features');
    assert(ctx.private === false, '@demands decorator cannot be applied to private/protected features');
    assert(!String(ctx.name).startsWith('_'), '@demands decorator cannot be applied to private/protected features');

    // Register at decoration time. `addInitializer` runs once per instance, so
    // registering there appended the same predicate again on every
    // instantiation: unbounded metadata growth and a linearly growing predicate
    // list to evaluate on each call.
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

    // If ANY demand is true then the obligation is considered fulfilled
    for (const [index, d] of ds.entries())
        if (assertContractResult(d(instance, args), '@demands', `${instance.constructor.name}.${String(propertyKey)}`, index)) return;

    // If we reach here, it means all demands were false
    assert(false, `No demands were satisfied for ${instance.constructor.name}.${String(propertyKey)}`);
}