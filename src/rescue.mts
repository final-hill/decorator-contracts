import { assert } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

export type RescueHandler<This extends Contracted> =
    (self: This, error: unknown, args: any[], retry: (this: This, ...args: any[]) => any) => void

export type RescueDecorator = <This extends Contracted>(
    handler: RescueHandler<This>
) => (
    value: unknown,
    context: FeatureDecoratorContext
) => void;

export const rescue: RescueDecorator = (handler) => (_feature, ctx) => {
    assert(["method", "getter", "setter"].includes(ctx.kind), '@rescue decorator can only be applied to methods, getters, or setters');
    assert(ctx.static === false, '@rescue decorator cannot be applied to static features');
    assert(ctx.private === false, '@rescue decorator cannot be applied to private features');
    assert(!String(ctx.name).startsWith('_'), '@rescue decorator cannot be applied to private/protected features');

    ctx.addInitializer(function () {
        assert(this instanceof Contracted, '@rescue decorator can only be applied to classes that extend Contracted');

        ctx.metadata.rescue = {
            ...(ctx.metadata?.rescue ?? {}),
            [ctx.name]: handler
        }
    })
}

/**
 * Applies the `@rescue` handler declared for `propertyKey`, if any.
 *
 * When the handler calls `retry`, the arguments passed to `retry` are returned
 * so that the caller can restart the contract lifecycle with them. This keeps
 * the lifecycle in one place (see `runLifecycle` in `Contracted.mts`) and
 * ensures a retried invocation is subject to `@invariant`, `@demands`, and
 * `@ensures` like any other invocation.
 *
 * @returns The arguments to retry with.
 * @throws The original error if the handler does not call `retry`, or whatever
 *   the handler throws.
 */
export const applyRescueHandler = (instance: Contracted, propertyKey: PropertyKey, error: unknown, args: any): any[] => {
    if (!Contracted[checkedMode]) throw error;

    const Class = instance.constructor as typeof Contracted,
        r = Class[Symbol.metadata]?.rescue?.[propertyKey] as RescueHandler<Contracted> | undefined;

    if (!r) throw error;

    let hasRetried = false;
    let retryArgs: any[] = [];
    Contracted[checkedMode] = false; // Disable checked mode to avoid infinite recursion

    try {
        r.call(instance, instance, error, args, (...args: any[]) => {
            assert(!hasRetried, 'retry can only be called once');
            hasRetried = true;
            retryArgs = args;
        })
        if (!hasRetried)
            throw error;
    } finally {
        Contracted[checkedMode] = true;
    }

    return retryArgs;
}
