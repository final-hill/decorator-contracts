import { assert, assertContractResult, violationError } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import { assertFeatureContractTarget } from './decorator.mjs';
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

export type EnsuresDecorator = <
    This extends Contracted,
    Args extends any[]
>(
    predicate: (self: This, args: Args, old: This) => boolean
) => (
    value: unknown,
    context: FeatureDecoratorContext
) => void;

export const ensures: EnsuresDecorator = (predicate) => (feature, ctx) => {
    assertFeatureContractTarget('@ensures', feature, ctx);

    const es = [
        ...(ctx.metadata as any)?.ensures?.[ctx.name] ?? [],
        predicate
    ]

    ctx.metadata.ensures = {
        ...(ctx.metadata?.ensures ?? {}),
        [ctx.name]: es
    };

    ctx.addInitializer(function () {
        assert(this instanceof Contracted, '@ensures decorator can only be applied to classes that extend Contracted');
    })
}

export function assertEnsures(instance: Contracted, old: Contracted, propertyKey: PropertyKey, args: any) {
    if (!Contracted[checkedMode]) return;

    const Class = instance.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[propertyKey] ?? [] as EnsuresPredicate<Contracted>[];

    if (es.length === 0) return;

    const label = `${instance.constructor.name}.${String(propertyKey)}`,
        failed: number[] = [];

    // ALL ensures must be true for the obligation to be fulfilled
    for (const [index, e] of es.entries())
        if (!assertContractResult(e(instance, args, old), '@ensures', label, index))
            failed.push(index);

    if (failed.length === 0) return;

    throw violationError(
        '@ensures',
        instance.constructor.name,
        String(propertyKey),
        es,
        failed,
        'A postcondition was not satisfied after the feature ran.',
    );
}
