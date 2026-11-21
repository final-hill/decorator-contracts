import { assertInvariants, InvariantPredicate } from './invariant.mjs';
import { assertDemands, DemandsPredicate } from './demands.mjs';
import { assertEnsures, EnsuresPredicate } from './ensures.mjs';
import { applyRescueHandler as applyRescueHandler, getRescueDeclaration, RescueDeclaration } from './rescue.mjs';

// Symbol to store checked mode state
export const checkedMode = Symbol.for('Contracted.checkedMode');

const populateOld = (target: Contracted) => {
    if (!Contracted[checkedMode]) return;

    Contracted[checkedMode] = false; // Disable checked mode to avoid infinite recursion

    try {
        const old = Object.create(target)
        for (const key in target)
            Reflect.set(old, key, Reflect.get(target, key));

        return old;
    } finally {
        Contracted[checkedMode] = true;
    }
}

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

        if (typeof descriptor?.value === 'function')
            return function (this: Contracted, ...methodArgs: any[]) {
                return runLifecycle('func', target, prop, methodArgs, (args) => Reflect.apply(descriptor.value!, target, args));
            }
        else if (typeof descriptor?.get === 'function')
            return runLifecycle('get', target, prop, [], () => Reflect.get(target, prop, receiver));
        else
            return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
        if (!Contracted[checkedMode]) return Reflect.set(target, prop, value, receiver);

        const descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop)

        if (!(descriptor && typeof descriptor.set === 'function'))
            if (typeof prop === 'string' && !prop.startsWith('_'))
                throw new TypeError(`Cannot assign to property '${String(prop)}': only properties starting with '_' or with a setter can be set on Contracted instances.`);

        return runLifecycle('set', target, prop, [value], (args) => Reflect.set(target, prop, args[0], receiver));
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