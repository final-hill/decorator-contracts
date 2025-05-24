import { assert } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

export type EnsuresPredicate<This extends Contracted> = (self: This, args: any[], old: This) => boolean;

export type EnsuresDecorator = <
    This extends Contracted
>(
    predicate: EnsuresPredicate<This>
) => (
    value: unknown,
    context: FeatureDecoratorContext
) => void;

export const ensures: EnsuresDecorator = (predicate) => (_feature, ctx) => {
    assert(["method", "getter", "setter"].includes(ctx.kind), '@ensures decorator can only be applied to methods, getters, or setters');
    assert(ctx.static === false, '@ensures decorator cannot be applied to static features');
    assert(ctx.private === false, '@ensures decorator cannot be applied to private features');
    assert(!String(ctx.name).startsWith('_'), '@ensures decorator cannot be applied to private/protected features');

    ctx.addInitializer(function () {
        assert(this instanceof Contracted, '@ensures decorator can only be applied to classes that extend Contracted');
        const es = [
            ...(ctx.metadata as any)?.ensures?.[ctx.name] ?? [],
            predicate
        ]

        ctx.metadata.ensures = {
            ...(ctx.metadata?.ensures ?? {}),
            [ctx.name]: es
        };
    })
}

export function assertEnsures(instance: Contracted, old: Contracted, propertyKey: PropertyKey, args: any) {
    if (!Contracted[checkedMode]) return;

    Contracted[checkedMode] = false; // Disable checked mode to avoid infinite recursion

    const Class = instance.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[propertyKey] ?? [] as EnsuresPredicate<Contracted>[];

    try {
        if (es.length === 0) return;

        // ALL ensures must be true for the obligation to be fulfilled
        for (const e of es)
            if (!e(instance, args, old))

                assert(false, `No ensurances were satisfied for ${instance.constructor.name}.${String(propertyKey)}`);
        // If we reach here, it means all ensures were true
    } finally {
        Contracted[checkedMode] = true;
    }
}
