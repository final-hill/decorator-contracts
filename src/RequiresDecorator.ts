/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import MemberDecorator, { MSG_NO_STATIC, MSG_INVALID_DECORATOR } from './MemberDecorator';
import isConstructor from './lib/isConstructor';
import DescriptorWrapper from './lib/DescriptorWrapper';

export type RequireType = (...args: any[]) => boolean;

export const MSG_DUPLICATE_REQUIRES = `Only a single @requires decorator can be assigned to a class feature`;

/**
 * The `@requires` decorator is an assertion of a precondition.
 * It expresses a condition that must be true before the associated class member is executed.
 */
export default class RequiresDecorator extends MemberDecorator {
    /**
     * Constructs a new instance of the RequiresDecorator in the specified mode
     * Enabled when checkMode is true, and disabled otherwise
     *
     * @param checkMode - The flag representing mode of the assertion
     */
    constructor(protected checkMode: boolean) {
        super(checkMode);
        this.requires = this.requires.bind(this);
    }

    /**
     * The 'requires' decorator. This is a feature decorator only.
     *
     * @param fnRequires - The assertion
     */
    requires(fnRequires: RequireType) {
        let self = this,
            assert = this._assert;
        this._checkedAssert(typeof fnRequires == 'function', MSG_INVALID_DECORATOR);
        this._checkedAssert(!isConstructor(fnRequires), MSG_INVALID_DECORATOR);

        return function(target: any, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
            let isStatic = typeof target == 'function';
            assert(!isStatic, MSG_NO_STATIC, TypeError);

            if(!self.checkMode) {
                return currentDescriptor;
            }

            let Clazz = (target as any).constructor,
                dw = new DescriptorWrapper(currentDescriptor),
                registration = MemberDecorator.registerFeature(Clazz, propertyKey, dw);

            registration.hasRequires = assert(!registration.hasRequires, MSG_DUPLICATE_REQUIRES);
            registration.requires = fnRequires;

            return dw.descriptor!;
        };
    }
}