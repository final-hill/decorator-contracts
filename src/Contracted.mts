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
 * @param invokeArgs - The arguments for this invocation. `retry` replaces them.
 * @param invoke - Performs the feature body with the supplied arguments.
 */
function runLifecycle(
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
        assertDemands(target, prop, args);

        let result: any
        try {
            result = invoke(args);
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

            // The descriptor is resolved from the instance's prototype chain,
            // which is fixed for the lifetime of the instance, so the wrapper
            // can be reused for that feature.
            //
            // The body receives the raw target as `this`. A feature body is `C`
            // in `{ P } C { Q }`: what it does internally is unconstrained, so
            // internal accesses must not re-enter the traps.
            const wrapper = function (this: Contracted, ...methodArgs: any[]) {
                return runLifecycle('func', target, prop, methodArgs,
                    (args) => Reflect.apply(descriptor.value!, target, args));
            };

            cache.set(prop, wrapper);

            return wrapper;
        }
        else if (typeof descriptor?.get === 'function')
            return runLifecycle('get', target, prop, [], () => descriptor.get!.call(target));
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