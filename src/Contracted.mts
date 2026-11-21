import { assertInvariants, InvariantPredicate } from './invariant.mjs';
import { assertDemands, DemandsPredicate } from './demands.mjs';
import { assertEnsures, EnsuresPredicate } from './ensures.mjs';
import { applyRescueHandler as applyRescueHandler, getRescueDeclaration, RescueDeclaration } from './rescue.mjs';

// Symbol to store checked mode state
export const checkedMode = Symbol.for('Contracted.checkedMode');

/**
 * Instances whose contract lifecycle is currently running.
 *
 * Feature bodies execute with `this` bound to the proxy so that encapsulation is
 * enforced from inside a feature, not only from outside. That means an access
 * made by a body (or by a predicate) re-enters the traps. Those nested accesses
 * must not start a second lifecycle, or a single public invocation would nest
 * one lifecycle per internal access.
 *
 * This replaces the previous global `checkedMode` toggle, which disabled
 * contracts for every instance in the process while a nested access was
 * evaluated.
 */
const activeInstances = new WeakSet<object>();

const isActive = (instance: object): boolean => activeInstances.has(instance);

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
 * Runs contract evaluation with this instance marked as active.
 *
 * While marked, the traps still enforce encapsulation (so a body writing to a
 * non-`_` property is rejected) but no longer start a nested lifecycle, so a
 * single public invocation runs exactly one lifecycle regardless of how many
 * internal accesses its body performs.
 *
 * The mark is only cleared by the invocation that set it, so a body entering
 * another contracted feature cannot clear it while the outer lifecycle is still
 * running.
 */
function runActive<T>(target: Contracted, action: () => T): T {
    const wasActive = activeInstances.has(target);

    activeInstances.add(target);

    try {
        return action();
    } finally {
        if (!wasActive) activeInstances.delete(target);
    }
}

/**
 * Runs the assertion lifecycle for a single invocation:
 * `@invariant` -> `@demands` -> body -> `@ensures` -> `@invariant`.
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
 * @param invokeArgs - The arguments for this invocation. `retry` replaces them.
 * @param invoke - Performs the feature body with the supplied arguments.
 */
function runLifecycle(
    descriptorType: 'get' | 'set' | 'func',
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

        runActive(target, () => {
            assertInvariants(Class, target);
            assertDemands(target, prop, args);
        });

        let result: any
        try {
            result = invoke(args);
            if (hasEnsures)
                runActive(target, () => assertEnsures(target, old, prop, descriptorType === 'get' ? [result] : args));
        } catch (error) {
            const maxRetries = getRescueDeclaration(target, prop)?.maxRetries ?? Infinity;

            if (retries >= maxRetries) {
                runActive(target, () => assertInvariants(Class, target));
                throw error;
            }

            retries++;
            try {
                args = runActive(target, () => applyRescueHandler(target, prop, error, descriptorType === 'get' ? [] : args));
            } catch (rescuedError) {
                runActive(target, () => assertInvariants(Class, target));
                throw rescuedError;
            }
            continue;
        }

        runActive(target, () => assertInvariants(Class, target));
        return result;
    }
}

const proxyHandler: ProxyHandler<Contracted> = {
    get(target, prop, receiver) {
        if (!Contracted[checkedMode]) return Reflect.get(target, prop, receiver);

        const descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop);

        // A feature entered while a lifecycle is already running on this
        // instance, such as a method called from a getter body, must not start a
        // second lifecycle. The enclosing invocation owns the assertions, and
        // nesting one lifecycle per internal access would multiply predicate
        // evaluations without adding a guarantee.
        if (isActive(target))
            return typeof descriptor?.value === 'function'
                ? (...methodArgs: any[]) => Reflect.apply(descriptor.value!, receiver, methodArgs)
                : typeof descriptor?.get === 'function'
                    ? descriptor.get.call(receiver)
                    : Reflect.get(target, prop, receiver);

        if (typeof descriptor?.value === 'function') {
            let cache = wrapperCache.get(target);

            if (!cache) {
                cache = new Map();
                wrapperCache.set(target, cache);
            }

            const cached = cache.get(prop);

            if (cached) return cached;

            // The descriptor is resolved from the instance's prototype chain,
            // which is fixed for the lifetime of the instance, so the wrapper
            // can be reused for that feature.
            const wrapper = function (this: Contracted, ...methodArgs: any[]) {
                return runLifecycle('func', target, prop, methodArgs,
                    (args) => runActive(target, () => Reflect.apply(descriptor.value!, receiver, args)));
            };

            cache.set(prop, wrapper);

            return wrapper;
        }
        else if (typeof descriptor?.get === 'function')
            // Invoke the accessor with the proxy as `this` so encapsulation is
            // enforced from inside the body. `runBody` records that a lifecycle
            // is already running, so the body's own property accesses do not
            // start a nested one.
            return runLifecycle('get', target, prop, [],
                () => runActive(target, () => descriptor.get!.call(receiver)));
        else
            return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
        if (!Contracted[checkedMode]) return Reflect.set(target, prop, value, receiver);

        const descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop)

        if (!(descriptor && typeof descriptor.set === 'function'))
            if (typeof prop === 'string' && !prop.startsWith('_'))
                throw new TypeError(`Cannot assign to property '${String(prop)}': only properties starting with '_' or with a setter can be set on Contracted instances.`);

        // A nested write made by a running lifecycle through the proxy is plain
        // state mutation: the enclosing lifecycle already owns the assertions
        // for this invocation. Encapsulation above still applies, so a body
        // cannot bypass it.
        if (isActive(target)) return Reflect.set(target, prop, value, receiver);

        // Invoke the setter with the proxy as `this`, for the same reason as the
        // getter. A plain data property (an `_`-prefixed field) has no setter.
        const setter = typeof descriptor?.set === 'function' ? descriptor.set : undefined;

        runLifecycle('set', target, prop, [value],
            (args) => runActive(target, () => setter
                ? (setter.call(receiver, args[0]), true)
                : Reflect.set(target, prop, args[0], receiver)));

        // A `set` trap must report success or the assignment throws in strict
        // mode. Accessors do not return a meaningful value, so success is
        // implicit once the lifecycle completes.
        return true;
    },
    deleteProperty(target, prop) {
        throw new TypeError(`Cannot delete property '${String(prop)}' from Contracted instances.`);
    },
};

export class Contracted {
    static [Symbol.metadata]: {
        invariants: InvariantPredicate<typeof Contracted>[];
        demands: Record<PropertyKey, DemandsPredicate<Contracted>[]>;
        ensures: Record<PropertyKey, EnsuresPredicate<Contracted>[]>;
        rescue: Record<PropertyKey, RescueDeclaration<Contracted>>;
    };

    // Prevents direct instantiation of the class
    protected static _allowConstruction = false;

    // Symbol-based checked mode state
    public static [checkedMode]: boolean = true;

    static new<
        C extends typeof Contracted,
        Args extends ConstructorParameters<C>,
    >(this: C, ...args: Args): InstanceType<C> {
        (this as any)._allowConstruction = true;
        try {
            const instance = new this(...args) as InstanceType<C>;
            assertInvariants(this, instance);

            return new Proxy<InstanceType<C>>(instance, proxyHandler);
        } finally {
            (this as any)._allowConstruction = false;
        }
    }

    constructor(..._args: any[]) {
        const Class = this.constructor as typeof Contracted;
        if (!Class._allowConstruction)
            throw new TypeError("Use the static 'new' method to instantiate this class.")
    }
}