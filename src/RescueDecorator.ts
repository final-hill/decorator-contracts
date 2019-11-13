/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_NO_STATIC, MSG_DECORATE_METHOD_ACCESSOR_ONLY } from './MemberDecorator';
import DescriptorWrapper from './lib/DescriptorWrapper';
import isConstructor from './lib/isContructor';

type FnRescue<T extends Constructor<any>> = (self: T, error: Error, args: IArguments, retry: Function, fail: Function) => void;

export const RESCUE_LIST = Symbol('Rescue List');

const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
const MSG_DUPLICATE_RESCUE = 'Only a single rescue can be assigned to a feature';

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
    rescue<Self extends Constructor<any>>(fnRescue: FnRescue<Self>) {
        let self = this,
            assert = this._assert;
        assert(typeof fnRescue == 'function', MSG_INVALID_DECORATOR);
        assert(!isConstructor(fnRescue), MSG_INVALID_DECORATOR);

        return function(target: Function | object, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
            if(!self.debugMode) {
                return currentDescriptor;
            }

            let isStatic = typeof target == 'function',
                dw = new DescriptorWrapper(currentDescriptor);
            // Potentially undefined in pre ES5 environments (compilation target)
            assert(dw.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
            assert(!isStatic, MSG_NO_STATIC, TypeError);
            assert(dw.isMethod || dw.isProperty || dw.isAccessor);

            let Clazz = (target as any).constructor,
                rescueList: Map<PropertyKey, FnRescue<Self>> = Object.getOwnPropertySymbols(Clazz).includes(RESCUE_LIST) ?
                    Clazz[RESCUE_LIST]! : Clazz[RESCUE_LIST] = new Map();

            assert(!rescueList.has(propertyKey), MSG_DUPLICATE_RESCUE);
            rescueList.set(propertyKey, fnRescue);

            return currentDescriptor;
        };
    }
}