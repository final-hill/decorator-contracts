/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_NO_STATIC, MSG_INVALID_DECORATOR } from './MemberDecorator';
import DescriptorWrapper from './lib/DescriptorWrapper';

export type PredicateType = (...args: any[]) => boolean;

export const MSG_DUPLICATE_DEMANDS = `Only a single @demands decorator can be assigned to a class feature`;

/**
 * The `@demands` decorator is an assertion of a precondition.
 * It expresses a condition that must be true before the associated class member is executed.
 */
export default class DemandsDecorator extends MemberDecorator {
    /**
     * Constructs a new instance of the DemandsDecorator in the specified mode
     * Enabled when checkMode is true, and disabled otherwise
     *
     * @param checkMode - The flag representing mode of the assertion
     */
    constructor(protected checkMode: boolean) {
        super(checkMode);
        this.demands = this.demands.bind(this);
    }

    /**
     * The 'demands' decorator. This is a feature decorator only.
     *
     * @param fnPredicate - The assertion
     */
    demands(fnPredicate: PredicateType) {
        let self = this,
            assert = this._assert;
        this._checkedAssert(typeof fnPredicate == 'function', MSG_INVALID_DECORATOR);

        return function(target: any, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
            let isStatic = typeof target == 'function';
            assert(!isStatic, MSG_NO_STATIC, TypeError);

            if(!self.checkMode) {
                return currentDescriptor;
            }

            let Clazz = (target as any).constructor,
                dw = new DescriptorWrapper(currentDescriptor),
                registration = MemberDecorator.registerFeature(Clazz, propertyKey, dw);

            registration.hasDemands = assert(!registration.hasDemands, MSG_DUPLICATE_DEMANDS);
            registration.demands = fnPredicate;

            return dw.descriptor!;
        };
    }
}