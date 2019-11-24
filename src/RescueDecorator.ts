/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_NO_STATIC, MSG_DECORATE_METHOD_ACCESSOR_ONLY, MSG_INVARIANT_REQUIRED} from './MemberDecorator';
import DescriptorWrapper from './lib/DescriptorWrapper';
import isConstructor from './lib/isContructor';
import { HAS_INVARIANT } from './InvariantDecorator';

export const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
export const MSG_DUPLICATE_RESCUE = 'Only a single @rescue can be assigned to a feature';
export const MSG_NO_PROPERTY_RESCUE = 'A property can not be assigned a @rescue';
export const MSG_SINGLE_RETRY = `retry can only be called once`;

const RESCUE_SET = Symbol('Rescue Map');
type RescueSetType = Set<PropertyKey>;
type RescueType = (error: any, args: any[], retry: Function) => void;

/**
 * The `rescue` decorator enables a mechanism for providing Robustness.
 */
export default class RescueDecorator extends MemberDecorator {
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
    rescue(fnRescue: RescueType) {
        let self = this,
            assert = this._assert;
        this._checkedAssert(typeof fnRescue == 'function', MSG_INVALID_DECORATOR);
        this._checkedAssert(!isConstructor(fnRescue), MSG_INVALID_DECORATOR);

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
            let Clazz = (target as any).constructor,
                rescueSet: RescueSetType = Object.getOwnPropertySymbols(Clazz).includes(RESCUE_SET) ?
                    Clazz[RESCUE_SET]! : Clazz[RESCUE_SET] = new Set();

            assert(!rescueSet.has(propertyKey), MSG_DUPLICATE_RESCUE);
            rescueSet.add(propertyKey);

            let newDescriptor: PropertyDescriptor = {
                configurable: true,
                enumerable: true
            };

            // TODO: generalize
            if(dw.isMethod) {
                newDescriptor.writable = true;
                newDescriptor.value = function(this: object, ...args: any[]) {
                    let Clazz: Function & {[HAS_INVARIANT]?: boolean} = this.constructor,
                        hasInvariant = Boolean(Clazz[HAS_INVARIANT]);
                    assert(hasInvariant, MSG_INVARIANT_REQUIRED);

                    let feature: Function = dw.value;
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
            } else {
                if(dw.hasGetter) {
                    newDescriptor.get = function(this: object) {
                        let Clazz: Function & {[HAS_INVARIANT]?: boolean} = this.constructor,
                            hasInvariant = Boolean(Clazz[HAS_INVARIANT]);
                        assert(hasInvariant, MSG_INVARIANT_REQUIRED);

                        try {
                            return dw.descriptor!.get!.call(this);
                        } catch(error) {
                            let hasRetried = false;
                            try {
                                return fnRescue.call(this, error, [], () => {
                                    hasRetried = assert(!hasRetried, MSG_SINGLE_RETRY);

                                    return dw.descriptor!.get!.call(this);
                                });
                            } catch(error) {
                                throw error;
                            }
                        }
                    };
                }
                if(dw.hasSetter) {
                    newDescriptor.set = function(this: object, value: any) {
                        let Clazz: Function & {[HAS_INVARIANT]?: boolean} = this.constructor,
                            hasInvariant = Boolean(Clazz[HAS_INVARIANT]);
                        assert(hasInvariant, MSG_INVARIANT_REQUIRED);

                        try {
                            dw.descriptor!.set!.call(this, value);
                        } catch(error) {
                            let hasRetried = false;
                            try {
                                return fnRescue.call(this, error, [value], (retryValue: any) => {
                                    hasRetried = assert(!hasRetried, MSG_SINGLE_RETRY);

                                    dw.descriptor!.set!.call(this, retryValue);
                                });
                            } catch(error) {
                                throw error;
                            }
                        }
                    };
                }
            }

            return newDescriptor;
        };
    }
}