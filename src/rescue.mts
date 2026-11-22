import { assert } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import { assertFeatureContractTarget } from './decorator.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * The fields a rescue handler is called with.
 *
 * `self` is the **raw** instance. Restoring corrupted state is what a handler is
 * for, so unlike a predicate it must be able to assign — `read-only.mts` excludes
 * `@rescue` for that reason.
 *
 * `retry` is an ordinary function field, called as `retry(...)`. It is not a
 * method of the subject, so lifting it off (`subject.retry(...)`) is unnecessary
 * and would give it a `this` it does not want. The handler itself carries no
 * `this: This` annotation for the same reason: the `this` context of a bare call
 * is `void`, so a declared `this` makes every consumer-written handler fail to
 * type-check. The subject carries the instance instead.
 */
export interface RescueSubject<This> {
    readonly self: This;
    readonly error: unknown;
    readonly args: any[];
    readonly retry: (...args: any[]) => any;
}

/**
 * A handler for `@rescue`.
 *
 * It takes one object rather than a positional list, matching the other
 * contracts. See {@link RescueSubject} for the fields and for why `retry` is a
 * bare callable.
 */
export type RescueHandler<This extends Contracted> =
    (subject: RescueSubject<This>) => void

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
 * replays the original arguments. Forward the `args` field to retry with the
 * same arguments (`retry(...args)`); calling `retry()` retries with none.
 *
 * Options are declaration level because they describe the feature rather than an
 * individual failure. `maxRetries` bounds how many times `retry` may restart the
 * lifecycle for one invocation; it defaults to unbounded.
 */
export type RescueDecorator = <This extends Contracted, Args extends any[] = any[]>(
    handler: RescueHandler<This>,
    options?: RescueOptions,
) => (
    value: unknown,
    context: FeatureDecoratorContext<This, Args>
) => void;

export const rescue: RescueDecorator = (handler, options) => (feature, ctx) => {
    assertFeatureContractTarget('@rescue', feature, ctx);
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

    // `this` stays bound to the instance so a handler written with a `function`
    // expression keeps working; the instance is also supplied as `self`.
    declaration.handler.call(instance, {
        self: instance,
        error,
        args,
        retry: (...retryArguments: any[]) => {
            assert(!hasRetried, 'retry can only be called once per rescue execution');
            hasRetried = true;
            retryArgs = retryArguments;
        },
    });
    if (!hasRetried)
        throw error;

    return retryArgs;
}
