/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import MemberDecorator from './MemberDecorator';
import type {PredicateType} from './typings/PredicateType';
import DescriptorWrapper from './lib/DescriptorWrapper';
import Assertion from './Assertion';
import { MSG_INVALID_DECORATOR, MSG_NO_STATIC } from './Messages';

/**
 * The `@ensures` decorator is an assertion of a postcondition.
 * It expresses a condition that must be true after the associated class member is executed.
 */
export default class EnsuresDecorator extends MemberDecorator {
    /**
     * Constructs a new instance of the EnsuresDecorator in the specified mode
     * Enabled when checkMode is true, and disabled otherwise
     *
     * @param {boolean} checkMode - The flag representing the mode of the assertion
     */
    constructor(protected checkMode: boolean) {
        super(checkMode);
        this.ensures = this.ensures.bind(this);
    }

    /**
     * The 'ensures' decorator. This is a feature decorator only
     *
     * @param {PredicateType} predicate - The Assertion to test
     * @returns {MethodDecorator} - The method decorator
     * @throws {AssertionError} - Throws an AssertionError if the predicate is not a function
     */
    ensures(predicate: PredicateType): MethodDecorator {
        const checkMode = this.checkMode,
            assert: Assertion['assert'] = this._assert;
        this._checkedAssert(typeof predicate == 'function', MSG_INVALID_DECORATOR);

        return function(target: any, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
            const isStatic = typeof target == 'function';
            assert(!isStatic, MSG_NO_STATIC, TypeError);

            if(!checkMode) {
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