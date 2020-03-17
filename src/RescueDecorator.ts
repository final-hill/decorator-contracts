/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_NO_STATIC, MSG_DECORATE_METHOD_ACCESSOR_ONLY, MSG_INVARIANT_REQUIRED} from './MemberDecorator';
import DescriptorWrapper from './lib/DescriptorWrapper';
import isClass from './lib/isClass';
import type {Constructor} from './typings/Constructor';
import { DECORATOR_REGISTRY } from './DECORATOR_REGISTRY';
import type { RescueType } from './typings/RescueType';

export const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
export const MSG_DUPLICATE_RESCUE = 'Only a single @rescue can be assigned to a feature';
export const MSG_NO_PROPERTY_RESCUE = 'A property can not be assigned a @rescue';
export const MSG_SINGLE_RETRY = `retry can only be called once`;

const RESCUE_SET = Symbol('Rescue Map');
type RescueSetType = Set<PropertyKey>;

/**
 * The `rescue` decorator enables a mechanism for providing Robustness.
 */
export default class RescueDecorator extends MemberDecorator {
    /**
     * Returns an instance of the 'rescue' decorator in the specified mode.
     * When debugMode is true the decorator is enabled.
     * When debugMode is false the decorator has no effect
     *
     * @param checkMode - A flag representing mode of the decorator
     */
    constructor(protected checkMode: boolean) {
        super(checkMode);
        this.rescue = this.rescue.bind(this);
    }

    /**
     * The `rescue` decorator enables a mechanism for providing Robustness.
     */
    rescue(fnRescue: RescueType) {
        let self = this,
            assert = this._assert;
        this._checkedAssert(typeof fnRescue == 'function', MSG_INVALID_DECORATOR);
        this._checkedAssert(!isClass(fnRescue), MSG_INVALID_DECORATOR);

        return function(target: any, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
            if(!self.checkMode) {
                return currentDescriptor;
            }

            let isStatic = typeof target == 'function',
                dw = new DescriptorWrapper(currentDescriptor);
            // Potentially undefined in pre ES5 environments (compilation target)
            assert(dw.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
            assert(!isStatic, MSG_NO_STATIC, TypeError);
            assert(dw.isMethod || dw.isAccessor, MSG_DECORATE_METHOD_ACCESSOR_ONLY);

            let Clazz = (target as any).constructor,
                rescueSet: RescueSetType = Object.getOwnPropertySymbols(Clazz).includes(RESCUE_SET) ?
                    Clazz[RESCUE_SET]! : Clazz[RESCUE_SET] = new Set();

            assert(!rescueSet.has(propertyKey), MSG_DUPLICATE_RESCUE);
            rescueSet.add(propertyKey);

            let newDescriptor: PropertyDescriptor = {
                configurable: true,
                enumerable: true
            };

            let rescueFeature = (feature: Function) => function(this: object,  ...args: any[]) {
                let Clazz = this.constructor as Constructor<any>,
                    hasInvariant = DECORATOR_REGISTRY.has(Clazz);
                assert(hasInvariant, MSG_INVARIANT_REQUIRED);

                try {
                    return feature.call(this, ...args);
                } catch(error) {
                    let hasRetried = false;
                    try {
                        return fnRescue.call(this, error, args, (...retryArgs: any[]) => {
                            hasRetried = assert(!hasRetried, MSG_SINGLE_RETRY);

                            return feature.call(this, ...retryArgs);
                        });
                    } catch(error) {
                        throw error;
                    }
                }
            };

            if(dw.isMethod) {
                let feature: Function = dw.value;
                newDescriptor.writable = true;
                newDescriptor.value = rescueFeature(feature);
            } else {
                if(dw.hasGetter) {
                    let feature = dw.descriptor!.get!;
                    newDescriptor.get = rescueFeature(feature);
                }
                if(dw.hasSetter) {
                    let feature = dw.descriptor!.set!;
                    newDescriptor.set = rescueFeature(feature);
                }
            }

            return newDescriptor;
        };
    }
}