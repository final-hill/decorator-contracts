/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_NO_STATIC, MSG_DECORATE_METHOD_ACCESSOR_ONLY} from './MemberDecorator';
import DescriptorWrapper from './lib/DescriptorWrapper';
import isClass from './lib/isClass';
import type { RescueType } from './typings/RescueType';

export const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
export const MSG_DUPLICATE_RESCUE = 'Only a single @rescue can be assigned to a feature';
export const MSG_NO_PROPERTY_RESCUE = 'A property can not be assigned a @rescue';

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
            let isStatic = typeof target == 'function';

            if(!self.checkMode) {
                return currentDescriptor;
            }

            let Clazz = (target as any).constructor,
                dw = new DescriptorWrapper(currentDescriptor),
                registration = MemberDecorator.registerFeature(Clazz, propertyKey, dw);
            // Potentially undefined in pre ES5 environments (compilation target)
            assert(dw.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
            assert(!isStatic, MSG_NO_STATIC, TypeError);
            assert(dw.isMethod || dw.isAccessor, MSG_DECORATE_METHOD_ACCESSOR_ONLY);

            assert(registration.rescue == null, MSG_DUPLICATE_RESCUE);
            registration.rescue = fnRescue;

            return dw.descriptor!;
        };
    }
}