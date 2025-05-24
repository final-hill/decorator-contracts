import { assert } from './assert.mjs';
import { checkedMode, Contracted } from "./Contracted.mjs";
import type { FeatureDecoratorContext } from './types.mjs';

export type DemandsPredicate<This extends Contracted> = (self: This, ...args: any[]) => boolean;

export type DemandsDecorator = <This extends Contracted, Feature = unknown>(
    predicate: DemandsPredicate<This>
) => (
    value: Feature,
    context: FeatureDecoratorContext
) => Feature | void;

export const demands: DemandsDecorator = (predicate) => (_feature, ctx) => {
    assert(["method", "getter", "setter"].includes(ctx.kind), '@demands decorator can only be applied to methods, getters, or setters');
    assert(ctx.static === false, '@demands decorator cannot be applied to static features');
    assert(ctx.private === false, '@demands decorator cannot be applied to private/protected features');
    assert(!String(ctx.name).startsWith('_'), '@demands decorator cannot be applied to private/protected features');

    ctx.addInitializer(function () {
        assert(this instanceof Contracted, '@demands decorator can only be applied to classes that extend Contracted');
        const ds = [
            ...(ctx.metadata as any)?.demands?.[ctx.name] ?? [],
            predicate
        ]

        ctx.metadata.demands = {
            ...(ctx.metadata?.demands ?? {}),
            [ctx.name]: ds
        };
    })
}

export function assertDemands(instance: Contracted, propertyKey: PropertyKey, ...args: any[]) {
    if (!Contracted[checkedMode]) return;

    Contracted[checkedMode] = false; // Disable checked mode to avoid infinite recursion 

    const Class = instance.constructor as typeof Contracted,
        ds = Class[Symbol.metadata]?.demands?.[propertyKey] ?? [] as DemandsPredicate<Contracted>[];

    try {
        if (ds.length === 0) return;

        // If ANY demand is true then the obligation is considered fulfilled
        for (const d of ds)
            if (d(instance, ...args)) return;

        // If we reach here, it means all demands were false
        assert(false, `No demands were satisfied for ${instance.constructor.name}.${String(propertyKey)}`);
    } finally {
        Contracted[checkedMode] = true;
    }
}