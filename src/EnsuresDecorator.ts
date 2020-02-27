/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_INVALID_DECORATOR, MSG_NO_STATIC } from './MemberDecorator';
import type {PredicateType} from './typings/PredicateType';
import DescriptorWrapper from './lib/DescriptorWrapper';

/**
 * The `@ensures` decorator is an assertion of a postcondition.
 * It expresses a condition that must be true after the associated class member is executed.
 */
export default class EnsuresDecorator extends MemberDecorator {
    /**
     * Constructs a new instance of the EnsuresDecorator in the specified mode
     * Enabled when checkMoe is true, and disabled otherwise
     *
     * @param checkMode - The flag representing the mode of the assertion
     */
    constructor(protected checkMode: boolean) {
        super(checkMode);
        this.ensures = this.ensures.bind(this);
    }

    /**
     * The 'ensures' decorator. This is a feature decorator only
     * @param predicate
     */
    ensures(predicate: PredicateType) {
        const self = this,
            assert = this._assert;
        this._checkedAssert(typeof predicate == 'function', MSG_INVALID_DECORATOR);

        return function(target: any, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
            const isStatic = typeof target == 'function';
            assert(!isStatic, MSG_NO_STATIC, TypeError);

            if(!self.checkMode) {
                return currentDescriptor;
            }

            const Clazz = (target as any).constructor,
                dw = new DescriptorWrapper(currentDescriptor),
                registration = MemberDecorator.registerFeature(Clazz, propertyKey, dw);

            registration.ensures.push(predicate);

            return dw.descriptor!;
        };
    }
}