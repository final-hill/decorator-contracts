import { assert } from './assert.mjs';
import { contractsEnabled, Contracted } from './Contracted.mjs';
import { assertDecoratorContext, assertFeatureContractTarget } from './decorator.mjs';
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
 *
 * `feature` names the feature whose invocation failed. A per-feature declaration
 * already knows it, because the handler was written next to that feature; a
 * class-level declaration serves every feature, so without this field a handler
 * that translates or logs per feature has nothing to key on. The value is the
 * property key the lifecycle was running for, so a `delete` reports the deleted
 * property and an accessor reports the accessor's name.
 */
export interface RescueSubject<This> {
    readonly self: This;
    readonly error: unknown;
    readonly args: any[];
    readonly retry: (...args: any[]) => any;
    readonly feature: PropertyKey;
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
 * Declares a rescue handler for a feature, or for every feature of a class.
 *
 * `retry` is explicit: it passes only the arguments it is given and never
 * replays the original arguments. Forward the `args` field to retry with the
 * same arguments (`retry(...args)`); calling `retry()` retries with none.
 *
 * Options are declaration level because they describe the feature rather than an
 * individual failure. `maxRetries` bounds how many times `retry` may restart the
 * lifecycle for one invocation; it defaults to unbounded, and it is counted per
 * invocation of the feature the handler served rather than across the class.
 *
 * On a class the declaration applies to every feature that declares none of its
 * own. Precedence is feature-level first, then the nearest class-level
 * declaration walking up the constructor chain, so a subclass may override a
 * class-level handler its base declared without restating it per feature.
 *
 * The returned decorator takes one call signature whose context is the **union**
 * of the two positions, rather than two overloads. An overload pair cannot be
 * selected for a decorator expression: TypeScript resolves the class position
 * against the first signature and does not fall through, so a member-first pair
 * is rejected on a class and a class-first pair is rejected on a member. A union
 * is accepted in both positions and needs no ordering.
 *
 * `This` reaches both positions, and each supplies it differently: the member
 * context carries it through the decorated element's own signature, and the
 * class context through the constructor being decorated. Only the class context
 * is named by this type; the member context is left to `FeatureDecoratorContext`,
 * which already threads the instance through its three kind variants.
 *
 * The decorated element itself is typed `unknown` in both positions. Its type is
 * the feature's signature, which no handler reads, and naming it would make it a
 * second inference site for `This` — `typeof A` where the handler said `A` — and
 * a decorator expression has no way to unify the two.
 */
export type RescueDecorator = <This extends Contracted>(
    handler: RescueHandler<This>,
    options?: RescueOptions,
) => <Args extends any[]>(
    value: unknown,
    context: FeatureDecoratorContext<This, Args>
        | ClassDecoratorContext<abstract new (...args: any[]) => This>,
) => void;

export const rescue: RescueDecorator = (handler, options) => (element: unknown, ctx: unknown) => {
    assertDecoratorContext('@rescue', ctx);

    if (ctx.kind === 'class') {
        const Class = element as typeof Contracted;

        // A class decorator receives no instance, so there is no `this` to test in
        // `addInitializer`; the prototype chain is what says whether a subclass of
        // `Contracted` is being declared.
        assert(Class.prototype instanceof Contracted, '@rescue decorator can only be applied to classes that extend Contracted');
        assert(options?.maxRetries === undefined || options.maxRetries >= 0, 'maxRetries must not be negative');

        // A class decorator runs once for the class rather than once per member, so
        // it stores under its own key. `ctx.name` is the class name, which a feature
        // could also be called, so sharing the feature map would make the two forms
        // collide.
        ctx.metadata.classRescue = { handler, maxRetries: options?.maxRetries };

        return;
    }

    // The placement gate runs first, so a misplaced declaration reports that rather
    // than an option the placement made meaningless.
    assertFeatureContractTarget('@rescue', element, ctx);
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
 * The `@rescue` declaration a metadata record holds for `feature`.
 *
 * A feature-level declaration wins over a class-level one, which is what lets a
 * class serve a uniform handler and still let one feature state its own. A
 * feature's own entry is an own property of the map, copied into a subclass's
 * record by the spread a decorator performs; a class-level declaration is one
 * property, reached through the metadata prototype chain when this class did not
 * declare its own.
 *
 * A `_`-prefixed feature takes neither form: the decorator refuses one wherever it
 * is written, because `@rescue` is the only contract a handler applies, and a
 * lifecycle that starts for a `_` name would otherwise inherit a class-level
 * handler for it. Leaving the name out of both answers keeps the two forms
 * consistent, so a consumer never has a feature they can cover but not override.
 *
 * @internal
 * Exported because `metadata.mts` reports the same effective declaration this
 * module applies, so both have to answer the question one way. It is not
 * re-exported from the package entry: it returns the live declaration, and a
 * consumer has to read a copy through `getContractMetadata`.
 */
export const rescueDeclarationOf = (
    metadata: {
        rescue?: Readonly<Record<PropertyKey, RescueDeclaration<Contracted>>>,
        classRescue?: RescueDeclaration<Contracted>,
    } | undefined,
    feature: PropertyKey,
): RescueDeclaration<Contracted> | undefined =>
    String(feature).startsWith('_')
        ? undefined
        : metadata?.rescue?.[feature] ?? metadata?.classRescue;

/**
 * Resolves the `@rescue` declaration for `propertyKey`, walking the constructor
 * chain so that a declaration on an ancestor is inherited.
 *
 * The walk covers the case where a class inherited its base's metadata record by
 * `Symbol.metadata` lookup rather than owning one, so the record it sees is the
 * one its ancestor wrote; the first class whose record resolves a declaration
 * supplies it.
 */
export function getRescueDeclaration(instance: Contracted, propertyKey: PropertyKey): RescueDeclaration<Contracted> | undefined {
    for (let proto: any = instance.constructor; proto && proto !== Function.prototype; proto = Object.getPrototypeOf(proto)) {
        const metadata = proto[Symbol.metadata] as Parameters<typeof rescueDeclarationOf>[0];

        if (!metadata) continue;

        const declaration = rescueDeclarationOf(metadata, propertyKey);

        if (declaration) return declaration;
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
    if (!contractsEnabled(instance.constructor)) throw error;

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
        feature: propertyKey,
    });
    if (!hasRetried)
        throw error;

    return retryArgs;
}
