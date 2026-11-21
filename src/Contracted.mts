import { AssertionError } from './AssertionError.mjs';
import { assertInvariants, InvariantPredicate } from './invariant.mjs';
import { assertDemands, DemandsPredicate } from './demands.mjs';
import { assertEnsures, EnsuresPredicate } from './ensures.mjs';
import { applyRescueHandler as applyRescueHandler, getRescueDeclaration, RescueDeclaration } from './rescue.mjs';

// Symbol to store checked mode state
export const checkedMode = Symbol.for('Contracted.checkedMode');

/**
 * Type of value that `cloneState` copies rather than shares.
 *
 * The list is deliberately closed: arrays, dates, maps, sets, and plain objects
 * are cloned because they are the containers contracts routinely compare. Every
 * other object — class instances, functions, regular expressions, buffers — is
 * shared by reference. See the `@ensures` documentation for the rationale.
 */
const isPlainObject = (value: object): boolean => {
    const proto = Object.getPrototypeOf(value);

    return proto === Object.prototype || proto === null;
}

/**
 * Copies a value for use in an `old` snapshot.
 *
 * Plain data containers are cloned recursively so that mutations performed by
 * the feature body are not visible through `old`. Anything else is returned by
 * reference, which preserves identity and avoids attempting to clone values that
 * cannot be cloned meaningfully (functions, class instances, buffers).
 *
 * Own property descriptors are copied rather than values, so accessors are not
 * invoked while snapshotting. An accessor on `old` therefore reads the
 * historical state through `this`, which is what a postcondition expects.
 */
const cloneState = (value: any, seen: WeakMap<object, any>): any => {
    if (typeof value !== 'object' || value === null) return value;

    const already = seen.get(value);
    if (already !== undefined) return already;

    if (value instanceof Date) return new Date(value.getTime());

    if (Array.isArray(value)) {
        const copy: any[] = [];
        seen.set(value, copy);
        for (const item of value) copy.push(cloneState(item, seen));

        return copy;
    }

    if (value instanceof Map) {
        const copy = new Map<any, any>();
        seen.set(value, copy);
        for (const [k, v] of value) copy.set(cloneState(k, seen), cloneState(v, seen));

        return copy;
    }

    if (value instanceof Set) {
        const copy = new Set<any>();
        seen.set(value, copy);
        for (const item of value) copy.add(cloneState(item, seen));

        return copy;
    }

    if (!isPlainObject(value)) return value;

    const copy = Object.create(Object.getPrototypeOf(value));
    seen.set(value, copy);

    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        Reflect.defineProperty(copy, key, 'value' in descriptor
            ? { ...descriptor, value: cloneState(descriptor.value, seen) }
            : descriptor);
    }

    return copy;
}

/**
 * Builds the `old` instance passed to `@ensures`.
 *
 * The result inherits from `target`, so prototype members (including getters and
 * methods) remain reachable, while own state is a copy taken at this moment.
 * Getters defined on the prototype therefore read the historical own state
 * through `this`.
 */
const populateOld = (target: Contracted) => {
    if (!Contracted[checkedMode]) return;

    const old = Object.create(target),
        seen = new WeakMap<object, any>();

    for (const key of Reflect.ownKeys(target)) {
        const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
        Reflect.defineProperty(old, key, 'value' in descriptor
            ? { ...descriptor, value: cloneState(descriptor.value, seen) }
            : descriptor);
    }

    return old;
}

/**
 * How a feature's body hands its result back to the caller.
 *
 * A Hoare triple `{ P } C { Q }` only means something if `Q` is evaluated after
 * `C` has finished. For an `async` feature, `C` finishes when the promise it
 * returned settles, not when `Reflect.apply` returns it. The kind decides where
 * the exit boundary therefore sits.
 *
 * Generators are their own case and are rejected by the contract decorators for
 * now; see issue #318.
 */
type FeatureKind = 'sync' | 'async';

/**
 * Classifies a feature body by how it delivers its result.
 *
 * `Reflect.apply` on an `async` function returns its promise immediately, so the
 * only reliable signal is the function's constructor, which is stable across
 * bundling and minification (unlike `Function.prototype.name`).
 */
const featureKindOf = (fn: (...args: any[]) => unknown): FeatureKind =>
    fn.constructor.name === 'AsyncFunction' ? 'async' : 'sync';

/**
 * True when the feature is a generator or async generator.
 *
 * Exported for the decorators, which refuse generator features until the
 * contract boundary for them is decided (issue #318).
 */
export const isGeneratorFunction = (fn: unknown): boolean => {
    if (typeof fn !== 'function') return false;

    const name = fn.constructor.name;

    return name === 'GeneratorFunction' || name === 'AsyncGeneratorFunction';
};

// Caches the contract wrapper per instance and feature so that `f.m === f.m`.
const wrapperCache = new WeakMap<object, Map<PropertyKey, (...args: any[]) => any>>();

// Utility to walk up the prototype chain to find a property descriptor
function getPropertyDescriptor(obj: object, prop: PropertyKey): PropertyDescriptor | undefined {
    let proto = obj;
    while (proto && proto !== Object.prototype) {
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (desc) return desc;
        proto = Object.getPrototypeOf(proto);
    }
    return undefined;
}

/**
 * Runs the assertion lifecycle for a single public invocation.
 *
 * The contracts describe the observable boundary of a feature, in the sense of
 * a Hoare triple `{ P } C { Q }`: `@demands` is `P`, `@ensures` is `Q`, and the
 * feature body is `C`. Nothing inside `C` is constrained — a body may mutate its
 * own state, including public properties, and may call its own features without
 * re-entering the contracts. Correctness is the obligation that `P` and `Q` hold
 * at the boundary, with the invariant additionally holding on entry and exit.
 *
 * Order: `@invariant` -> `@demands` -> body -> `@ensures` -> `@invariant`
 * (see `docs/happy-path.png`).
 *
 * A `@rescue` may call `retry`, which restarts the lifecycle from `@invariant`
 * with the supplied arguments, so a retried invocation is subject to
 * `@demands` and `@ensures` like any other invocation
 * (see `docs/order-of-assertions.png`).
 *
 * A retried invocation that fails re-enters `@rescue`, so the handler runs once
 * per attempt. This is what N-Version programming requires: a handler can
 * select the next alternative each time it is executed. Retries are bounded by
 * the optional `maxRetries` option on the `@rescue` declaration.
 *
 * The exit boundary sits wherever the body's result becomes observable, so a
 * synchronous and an asynchronous body are run by separate functions below and
 * dispatched by `runLifecycle`.
 *
 * @param invokeArgs - The arguments for this invocation. `retry` replaces them.
 * @param invoke - Performs the feature body with the supplied arguments.
 */
function runSyncLifecycle(
    descriptorType: 'get' | 'set' | 'func' | 'delete',
    target: Contracted,
    prop: PropertyKey,
    invokeArgs: any[],
    invoke: (args: any[]) => any,
): any {
    const Class = target.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[prop] ?? [] as EnsuresPredicate<Contracted>[],
        hasEnsures = es.length > 0;

    let args = invokeArgs,
        retries = 0;

    for (; ;) {
        const old = hasEnsures ? populateOld(target) : undefined;

        assertInvariants(Class, target);
        assertDemands(target, prop, ...args);

        let result: any
        try {
            result = invoke(args);

            assertNotThenable(result, target, prop);

            if (hasEnsures)
                assertEnsures(target, old, prop, descriptorType === 'get' ? [result] : args);
        } catch (error) {
            const maxRetries = getRescueDeclaration(target, prop)?.maxRetries ?? Infinity;

            if (retries >= maxRetries) {
                assertInvariants(Class, target);
                throw error;
            }

            retries++;
            try {
                args = applyRescueHandler(target, prop, error, descriptorType === 'get' ? [] : args);
            } catch (rescuedError) {
                assertInvariants(Class, target);
                throw rescuedError;
            }
            continue;
        }

        assertInvariants(Class, target);
        return result;
    }
}

/**
 * Runs the contract lifecycle whose exit boundary is a promise settlement.
 *
 * An `async` body returns its promise from `Reflect.apply` before a single line
 * of it has run, so evaluating `@ensures` there would test a body that has not
 * executed. The exit boundary must therefore *follow* the value: the lifecycle
 * waits for the promise to settle and then runs `@ensures` and the exit
 * `@invariant` against the settled state.
 *
 * Two consequences shape the code below.
 *
 * The first is failure surface. A contract that is violated on entry is a
 * synchronous throw in `runSyncLifecycle`, but that would be a lie here: an
 * `async` function never throws synchronously, so a caller that adds a
 * precondition must not change how a failure is observed. Entry violations are
 * therefore delivered as a rejection, exactly as the undecorated body's own
 * throws are. Substituting a contracted implementation for a plain one is
 * transparent to the caller, which is the substitutability Liskov requires and
 * which the type system already enforces in both directions (`() => T` and
 * `() => Promise<T>` are mutually non-assignable, so neither is a subtype of the
 * other and no conversion is implied).
 *
 * The second is that `@rescue` must observe rejections, not just synchronous
 * throws. A rescue that retries restarts the lifecycle, so a retried attempt is
 * subject to every contract like any other invocation.
 */
async function runAsyncLifecycle(
    descriptorType: 'get' | 'set' | 'func' | 'delete',
    target: Contracted,
    prop: PropertyKey,
    invokeArgs: any[],
    invoke: (args: any[]) => any,
): Promise<any> {
    const Class = target.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[prop] ?? [] as EnsuresPredicate<Contracted>[],
        hasEnsures = es.length > 0;

    let args = invokeArgs,
        retries = 0;

    for (; ;) {
        const old = hasEnsures ? populateOld(target) : undefined;

        assertInvariants(Class, target);
        assertDemands(target, prop, ...args);

        let result: any;
        try {
            result = await invoke(args);
            if (hasEnsures)
                assertEnsures(target, old, prop, descriptorType === 'get' ? [result] : args);
        } catch (error) {
            const maxRetries = getRescueDeclaration(target, prop)?.maxRetries ?? Infinity;

            if (retries >= maxRetries) {
                assertInvariants(Class, target);
                throw error;
            }

            retries++;
            try {
                args = applyRescueHandler(target, prop, error, descriptorType === 'get' ? [] : args);
            } catch (rescuedError) {
                assertInvariants(Class, target);
                throw rescuedError;
            }
            continue;
        }

        assertInvariants(Class, target);
        return result;
    }
}

/**
 * Selects the lifecycle boundary for a feature body.
 *
 * An `async` body is awaited through `runAsyncLifecycle`; anything else is
 * evaluated synchronously. This is decided from the function itself rather than
 * from whether the result *looks* like a promise, so a synchronous feature that
 * happens to return a thenable is still checked synchronously — the contract
 * describes the feature as written, and such a feature's postcondition cannot
 * hold anyway because its body has not finished. `@demands` therefore fails it
 * with a message naming the feature.
 */
function runLifecycle(
    descriptorType: 'get' | 'set' | 'func' | 'delete',
    target: Contracted,
    prop: PropertyKey,
    invokeArgs: any[],
    invoke: (args: any[]) => any,
    kind: FeatureKind = 'sync',
): any {
    if (kind === 'async')
        return runAsyncLifecycle(descriptorType, target, prop, invokeArgs, invoke);

    return runSyncLifecycle(descriptorType, target, prop, invokeArgs, invoke);
}

/**
 * Rejects a thenable returned by a feature that is not declared `async`.
 *
 * A synchronous feature's contracts are evaluated when its body returns, so a
 * body that defers its work through a promise is checked before it has done
 * anything. `@ensures` would then describe a state the feature has not reached
 * yet, and the caller would receive a promise whose outcome no contract ever
 * observed.
 *
 * The alternative — awaiting any thenable — was rejected because it would make
 * `async` optional while silently changing when failure is reported: a plain
 * function cannot return a settled value for a rejection to accompany, so the
 * feature would have to become `async` for its errors to be observable anyway.
 * Failing closed keeps the declaration and the boundary in agreement, and the
 * message says what to do.
 */
const assertNotThenable = (result: unknown, target: Contracted, prop: PropertyKey): void => {
    if (result === null || typeof result !== 'object' && typeof result !== 'function') return;

    if (typeof (result as any).then !== 'function') return;

    throw new AssertionError(
        `${target.constructor.name}.${String(prop)} returned a promise but is not declared 'async', `
        + "so its contracts were evaluated before its body finished. Declare the feature 'async'.",
    );
}

const proxyHandler: ProxyHandler<Contracted> = {
    get(target, prop, receiver) {
        if (!Contracted[checkedMode]) return Reflect.get(target, prop, receiver);

        const descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop);

        if (typeof descriptor?.value === 'function') {
            let cache = wrapperCache.get(target);

            if (!cache) {
                cache = new Map();
                wrapperCache.set(target, cache);
            }

            const cached = cache.get(prop);

            if (cached) return cached;

            // Generator features are refused here as well as in the decorators,
            // because the decorators only run for features that declare a
            // contract. Refusing at the proxy keeps a bare generator from
            // appearing to be checked when it is not.
            if (isGeneratorFunction(descriptor.value))
                throw new TypeError(
                    `${target.constructor.name}.${String(prop)} is a generator, and the contract boundary for `
                    + 'generator features is not supported yet (see issue #318).',
                );

            const kind = featureKindOf(descriptor.value);

            // The descriptor is resolved from the instance's prototype chain,
            // which is fixed for the lifetime of the instance, so the wrapper
            // can be reused for that feature.
            //
            // The body receives the raw target as `this`. A feature body is `C`
            // in `{ P } C { Q }`: what it does internally is unconstrained, so
            // internal accesses must not re-enter the traps.
            const wrapper = function (this: Contracted, ...methodArgs: any[]) {
                return runLifecycle('func', target, prop, methodArgs,
                    (args) => Reflect.apply(descriptor.value!, target, args), kind);
            };

            cache.set(prop, wrapper);

            return wrapper;
        }
        else if (typeof descriptor?.get === 'function')
            return runLifecycle('get', target, prop, [],
                () => descriptor.get!.call(target), featureKindOf(descriptor.get!));
        else
            return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
        if (!Contracted[checkedMode]) return Reflect.set(target, prop, value, receiver);

        const descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop)

        // Encapsulation governs the external surface only. It exists so a caller
        // cannot mutate state without a postcondition to catch it; inside a body,
        // `@ensures` and `@invariant` provide that guarantee instead.
        if (!(descriptor && typeof descriptor.set === 'function'))
            if (typeof prop === 'string' && !prop.startsWith('_'))
                throw new TypeError(`Cannot assign to property '${String(prop)}': only properties starting with '_' or with a setter can be set on Contracted instances.`);

        const setter = typeof descriptor?.set === 'function' ? descriptor.set : undefined;

        runLifecycle('set', target, prop, [value],
            (args) => setter
                ? (setter.call(target, args[0]), true)
                : Reflect.set(target, prop, args[0], receiver));

        // A `set` trap must report success or the assignment throws in strict
        // mode. Accessors do not return a meaningful value, so success is
        // implicit once the lifecycle completes.
        return true;
    },
    deleteProperty(target, prop) {
        if (!Contracted[checkedMode]) return Reflect.deleteProperty(target, prop);

        // Deletion follows the same rule as assignment: it is an external
        // mutation, so it is subject to encapsulation and to the lifecycle.
        // Only `_`-prefixed properties, the ones a caller is allowed to mutate
        // in the first place, may also be removed.
        if (typeof prop === 'string' && !prop.startsWith('_'))
            throw new TypeError(`Cannot delete property '${String(prop)}' from Contracted instances: only properties starting with '_' can be deleted.`);

        return runLifecycle('delete', target, prop, [], () => Reflect.deleteProperty(target, prop));
    },
};

export class Contracted {
    static [Symbol.metadata]: {
        invariants: InvariantPredicate<typeof Contracted>[];
        demands: Record<PropertyKey, DemandsPredicate<Contracted>[]>;
        ensures: Record<PropertyKey, EnsuresPredicate<Contracted>[]>;
        rescue: Record<PropertyKey, RescueDeclaration<Contracted>>;
    };

    /**
     * Grants permission for exactly one `Contracted` constructor call.
     *
     * A boolean would leave the gate open for the whole duration of the
     * constructor, so a class that called `new Foo()` inside its own
     * constructor — directly or through a superclass — would obtain a raw,
     * unproxied instance and defeat every contract.
     *
     * `Contracted`'s constructor runs exactly once per construction, so a
     * single-use token is enough. Classes that do not declare their own
     * constructor call it implicitly; classes that do must call `super()` once.
     */
    protected static _allowedConstructions = 0;

    // Symbol-based checked mode state
    public static [checkedMode]: boolean = true;

    static new<
        C extends typeof Contracted,
        Args extends ConstructorParameters<C>,
    >(this: C, ...args: Args): InstanceType<C> {
        const previous = (this as any)._allowedConstructions;

        (this as any)._allowedConstructions = previous + 1;

        try {
            const instance = new this(...args) as InstanceType<C>;
            assertInvariants(this, instance);

            return new Proxy<InstanceType<C>>(instance, proxyHandler);
        } finally {
            // Restore rather than decrement: the constructor consumes the token,
            // so decrementing here would double-count. Restoring also clears it
            // if the constructor threw for any reason.
            (this as any)._allowedConstructions = previous;
        }
    }

    constructor(..._args: any[]) {
        const Class = this.constructor as typeof Contracted;

        if (Class._allowedConstructions <= 0)
            throw new TypeError("Use the static 'new' method to instantiate this class.");

        // Consume the token so a nested `new` inside a constructor cannot
        // borrow the outer construction's permission.
        Class._allowedConstructions--;
    }
}