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

export const applyRescueHandler = (descriptorType: 'get' | 'set' | 'func', instance: Contracted, propertyKey: PropertyKey, error: unknown, args: any) => {
    if (!Contracted[checkedMode]) return error;

    const Class = instance.constructor as typeof Contracted,
        descriptor = Object.getOwnPropertyDescriptor(Class.prototype, propertyKey)!,
        r = Class[Symbol.metadata]?.rescue?.[propertyKey] as RescueHandler<Contracted> | undefined;

    if (!r) throw error;

    let hasRetried = false;
    Contracted[checkedMode] = false; // Disable checked mode to avoid infinite recursion
    let result: any
    try {
        r.call(instance, instance, error, args, (...args: any[]) => {
            assert(!hasRetried, 'retry can only be called once');
            hasRetried = true;
            Contracted[checkedMode] = true;
            if (descriptorType == 'get')
                result = Reflect.get(instance, propertyKey, instance);
            else if (descriptorType == 'set')
                result = Reflect.set(instance, propertyKey, args[0], instance);
            else if (descriptorType == 'func')
                result = Reflect.apply(descriptor.value, instance, args);
        })
        if (!hasRetried)
            throw error;
    } finally {
        Contracted[checkedMode] = true;
    }

    return result;
}
