/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_NO_STATIC, MSG_DECORATE_METHOD_ACCESSOR_ONLY } from './MemberDecorator';
import DescriptorWrapper from './lib/DescriptorWrapper';

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
    rescue(target: Function | object, _propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
        if(!this.debugMode) {
            return currentDescriptor;
        }

        let assert = this._assert,
            isStatic = typeof target == 'function',
            dw = new DescriptorWrapper(currentDescriptor);

        // Potentially undefined in pre ES5 environments (compilation target)
        assert(dw.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
        assert(!isStatic, MSG_NO_STATIC, TypeError);
        assert(dw.isMethod || dw.isProperty || dw.isAccessor);

        return currentDescriptor;
    }
}