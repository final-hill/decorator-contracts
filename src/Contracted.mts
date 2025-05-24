import { assertInvariants, InvariantPredicate } from './invariant.mjs';
import { assertDemands, DemandsPredicate } from './demands.mjs';
import { assertEnsures, EnsuresPredicate } from './ensures.mjs';
import { applyRescueHandler as applyRescueHandler, RescueHandler } from './rescue.mjs';

// Symbol to store checked mode state
export const checkedMode = Symbol.for('Contracted.checkedMode');

const populateOld = (target: Contracted) => {
    if (!Contracted[checkedMode]) return;

    Contracted[checkedMode] = false; // Disable checked mode to avoid infinite recursion

    const old = Object.create(target)
    for (const key in target)
        Reflect.set(old, key, Reflect.get(target, key));

    Contracted[checkedMode] = true;

    return old;
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

const proxyHandler: ProxyHandler<Contracted> = {
    get(target, prop, receiver) {
        if (!Contracted[checkedMode]) return Reflect.get(target, prop, receiver);

        const Class = target.constructor as typeof Contracted,
            descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop),
            es = Class[Symbol.metadata]?.ensures?.[prop] ?? [] as EnsuresPredicate<Contracted>[],
            hasEnsures = es.length > 0,
            old = hasEnsures ? populateOld(target) : undefined;

        if (typeof descriptor?.value === 'function') {
            return function (this: Contracted, ...methodArgs: any[]) {
                assertInvariants(Class, target);
                assertDemands(target, prop, methodArgs);
                let result
                try {
                    result = Reflect.apply(descriptor.value, target, methodArgs);
                    if (hasEnsures) assertEnsures(target, old, prop, methodArgs);
                } catch (error) {
                    result = applyRescueHandler('func', target, prop as keyof Contracted, error, methodArgs);
                } finally {
                    assertInvariants(Class, target);
                }
                return result;
            }
        } else if (typeof descriptor?.get === 'function') {
            assertInvariants(Class, target);
            assertDemands(target, prop, []);
            let result
            try {
                result = Reflect.get(target, prop, receiver);
                if (hasEnsures) assertEnsures(target, old, prop, [result]);
            } catch (error) {
                result = applyRescueHandler('get', target, prop, error, []);
            } finally {
                assertInvariants(Class, target);
            }
            return result;
        } else {
            return Reflect.get(target, prop, receiver);
        }
    },
    set(target, prop, value, receiver) {
        if (!Contracted[checkedMode]) return Reflect.set(target, prop, value, receiver);

        const descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop)

        if (!(descriptor && typeof descriptor.set === 'function'))
            if (typeof prop === 'string' && !prop.startsWith('_'))
                throw new TypeError(`Cannot assign to property '${String(prop)}': only properties starting with '_' or with a setter can be set on Contracted instances.`);

        const Class = target.constructor as typeof Contracted,
            es = Class[Symbol.metadata]?.ensures?.[prop] ?? [] as EnsuresPredicate<Contracted>[],
            hasEnsures = es.length > 0,
            old = hasEnsures ? populateOld(target) : undefined;
        assertInvariants(Class, target);
        assertDemands(target, prop, [value]);
        let result
        try {
            result = Reflect.set(target, prop, value, receiver);
            if (hasEnsures) assertEnsures(target, old, prop, [value]);
        } catch (error) {
            result = applyRescueHandler('set', target, prop as keyof Contracted, error, [value])
        } finally {
            assertInvariants(Class, target);
        }

        return result;
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
        rescue: Record<PropertyKey, RescueHandler<Contracted>>;
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