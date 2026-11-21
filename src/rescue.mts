import { assert } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * A handler for `@rescue`.
 *
 * `retry` is an ordinary function, called as `retry(...)`, so it has no
 * meaningful `this`. Declaring `this: This` on it made every consumer-written
 * handler fail to type-check, because the `this` context of a bare call is
 * `void`.
 */
export type RescueHandler<This extends Contracted> =
    (self: This, error: unknown, args: any[], retry: (...args: any[]) => any) => void

export interface RescueOptions {
    /**
     * The maximum number of times `retry` may restart the lifecycle for a single
     * invocation. Defaults to `Infinity`, which allows a `@rescue` to implement
     * N-Version programming with any number of alternative strategies.
     *
     * Set this when a rescue handler always retries, to bound recursion.
     */
    maxRetries?: number;
}

export interface RescueDeclaration<This extends Contracted> {
    handler: RescueHandler<This>;
    maxRetries?: number;
}

/**
 * Declares a rescue handler for a feature.
 *
 * `retry` is explicit: it passes only the arguments it is given and never
 * replays the original arguments. Forward the `args` parameter to retry with
 * the same arguments (`retry(...args)`); calling `retry()` retries with none.
 *
 * Options are declaration level because they describe the feature rather than an
 * individual failure. `maxRetries` bounds how many times `retry` may restart the
 * lifecycle for one invocation; it defaults to unbounded.
 */
export type RescueDecorator = <This extends Contracted>(
    handler: RescueHandler<This>,
    options?: RescueOptions,
) => (
    value: unknown,
    context: FeatureDecoratorContext
) => void;

export const rescue: RescueDecorator = (handler, options) => (feature, ctx) => {
    assert(["method", "getter", "setter"].includes(ctx.kind), '@rescue decorator can only be applied to methods, getters, or setters');
    assert(ctx.static === false, '@rescue decorator cannot be applied to static features');
    assert(ctx.private === false, '@rescue decorator cannot be applied to private features');
    assert(!String(ctx.name).startsWith('_'), '@rescue decorator cannot be applied to private/protected features');
    assert(options?.maxRetries === undefined || options.maxRetries >= 0, 'maxRetries must not be negative');

    // Register at decoration time. `addInitializer` runs once per instance, so
    // registering there rewrote the same declaration on every instantiation.
    ctx.metadata.rescue = {
        ...(ctx.metadata?.rescue ?? {}),
        [ctx.name]: { handler, maxRetries: options?.maxRetries }
    }

    ctx.addInitializer(function () {
        assert(this instanceof Contracted, '@rescue decorator can only be applied to classes that extend Contracted');
    })
}

/**
 * Resolves the `@rescue` declaration for `propertyKey`, walking the prototype
 * chain so that a declaration on an ancestor feature is inherited.
 */
export function getRescueDeclaration(instance: Contracted, propertyKey: PropertyKey): RescueDeclaration<Contracted> | undefined {
    let proto: any = instance.constructor;
    while (proto && proto !== Function.prototype) {
        const declaration = proto[Symbol.metadata]?.rescue?.[propertyKey] as RescueDeclaration<Contracted> | undefined;

        if (declaration) return declaration;
        proto = Object.getPrototypeOf(proto);
    }

    return undefined;
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
 * `retry` may be called at most once per rescue execution. Because the lifecycle
 * re-enters `@rescue` when a retried invocation fails, a handler is executed
 * once per attempt, which is what N-Version programming requires.
 *
 * @returns The arguments to retry with.
 * @throws The original error if the handler does not call `retry`, or whatever
 *   the handler throws.
 */
export const applyRescueHandler = (instance: Contracted, propertyKey: PropertyKey, error: unknown, args: any): any[] => {
    if (!Contracted[checkedMode]) throw error;

    const declaration = getRescueDeclaration(instance, propertyKey);

    if (!declaration) throw error;

    let hasRetried = false;
    let retryArgs: any[] = [];

    declaration.handler.call(instance, instance, error, args, (...args: any[]) => {
        assert(!hasRetried, 'retry can only be called once per rescue execution');
        hasRetried = true;
        retryArgs = args;
    })
    if (!hasRetried)
        throw error;

    return retryArgs;
}
