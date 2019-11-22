/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_NO_STATIC, MSG_DECORATE_METHOD_ACCESSOR_ONLY, MSG_INVARIANT_REQUIRED } from './MemberDecorator';
import DescriptorWrapper from './lib/DescriptorWrapper';
import isConstructor from './lib/isContructor';
import Assertion from './Assertion';

export const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
export const MSG_DUPLICATE_RESCUE = 'Only a single @rescue can be assigned to a feature';
export const MSG_NO_PROPERTY_RESCUE = 'A property can not be assigned a @rescue';
export const MSG_SINGLE_RETRY = `retry can only be called once`;

let fnInvariantRequired = () => { throw new Error(MSG_INVARIANT_REQUIRED); };
let checkedAssert = new Assertion(true).assert;

const RESCUE_MAP = Symbol('Rescue Map');
type RescueMapType = Map<PropertyKey, [RescueType, DescriptorWrapper]>;
type RescueType = (error: any, args: any[], retry: Function) => void;

/**
 * The `rescue` decorator enables a mechanism for providing Robustness.
 */
export default class RescueDecorator extends MemberDecorator {
    static createDescriptor(dw: DescriptorWrapper, fnRescue: RescueType): PropertyDescriptor {
        let feature: Function;
        function rescueWrapped(this: object, ...args: any[]) {
            try {
                return feature.call(this, ...args);
            } catch(error) {
                try {
                    return fnRescue.call(this, error, args, (...args: any[]) => {
                        return feature.call(this, ...args);
                    });
                } catch(error) {
                    throw error;
                }
            }
        }

        let newDescriptor: PropertyDescriptor = {
            configurable: true,
            enumerable: true
        };

        if(dw.isMethod) {
            feature = dw.value;
            newDescriptor.writable = true;
            newDescriptor.value = rescueWrapped;
        } else {
            if(dw.hasGetter) {
                feature = dw.descriptor!.get!;
                newDescriptor.get = rescueWrapped;
            }
            if(dw.hasSetter) {
                feature = dw.descriptor!.set!;
                newDescriptor.set = rescueWrapped;
            }
        }

        return newDescriptor;
    }

    static registerRescues(
        Clazz: Function & {[RESCUE_MAP]?: RescueMapType},
        featureNames: Set<PropertyKey>
    ): void {
        let proto = Clazz.prototype,
            clazzSymbols = Object.getOwnPropertySymbols(Clazz),
            rescueMap: RescueMapType = clazzSymbols.includes(RESCUE_MAP) ?
                Clazz[RESCUE_MAP]! : new Map();

        featureNames.forEach(featureName => {
            if(rescueMap.has(featureName)) {
                let [fnRescue, dw] = rescueMap.get(featureName)!;
                checkedAssert(dw.isMethod || dw.isAccessor, MSG_DECORATE_METHOD_ACCESSOR_ONLY);
                let newDescriptor = this.createDescriptor(dw, fnRescue);
                Object.defineProperty(proto, featureName, newDescriptor);
            }
        });
    }

    /**
     * Returns an instance of the 'rescue' decorator in the specified mode.
     * When debugMode is true the decorator is enabled.
     * When debugMode is false the decorator has no effect
     *
     * @param debugMode - A flag representing mode of the decorator
     */
    constructor(protected debugMode: boolean) {
        super(debugMode);
        this.rescue = this.rescue.bind(this);
    }

    /**
     * The `rescue` decorator enables a mechanism for providing Robustness.
     */
    // TODO: more specific type
    rescue(rescueMethod: RescueType) {
        let self = this,
            assert = this._assert;
        this._checkedAssert(typeof rescueMethod == 'function', MSG_INVALID_DECORATOR);
        this._checkedAssert(!isConstructor(rescueMethod), MSG_INVALID_DECORATOR);

        return function(target: Function | object, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
            if(!self.debugMode) {
                return currentDescriptor;
            }

            let isStatic = typeof target == 'function',
                dw = new DescriptorWrapper(currentDescriptor);
            // Potentially undefined in pre ES5 environments (compilation target)
            assert(dw.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
            assert(!isStatic, MSG_NO_STATIC, TypeError);
            assert(dw.isMethod || dw.isAccessor, MSG_DECORATE_METHOD_ACCESSOR_ONLY);

            // TODO: enforce rescue method as an instance/ancestor member of target
            // TODO: simply RESCUE_MAP to a property registry
            let Clazz = (target as any).constructor,
                rescueMap: RescueMapType = Object.getOwnPropertySymbols(Clazz).includes(RESCUE_MAP) ?
                    Clazz[RESCUE_MAP]! : Clazz[RESCUE_MAP] = new Map();

            assert(!rescueMap.has(propertyKey), MSG_DUPLICATE_RESCUE);
            rescueMap.set(propertyKey, [rescueMethod, dw]);

            let invariantRequiredDescriptor: PropertyDescriptor = {
                configurable: true,
                enumerable: true
            };

            if(dw.isMethod) {
                invariantRequiredDescriptor.writable = true;
                invariantRequiredDescriptor.value = fnInvariantRequired;
            } else {
                if(dw.hasGetter) {
                    invariantRequiredDescriptor.get = fnInvariantRequired;
                }
                if(dw.hasSetter) {
                    invariantRequiredDescriptor.set = fnInvariantRequired;
                }
            }

            return invariantRequiredDescriptor;
        };
    }
}