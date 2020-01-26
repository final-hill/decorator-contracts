/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import DescriptorWrapper from './lib/DescriptorWrapper';
import MemberDecorator, { MSG_NO_STATIC } from './MemberDecorator';
import Assertion from './Assertion';
import Constructor from './typings/Constructor';

export const MSG_INVALID_ARG_LENGTH = `An overridden method must have the same number of parameters as its ancestor method`;
export const MSG_NO_MATCHING_FEATURE = `This feature does not override an ancestor feature.`;
export const MSG_DUPLICATE_OVERRIDE = `Only a single @override decorator can be assigned to a class member`;

let checkedAssert = new Assertion(true).assert;

/**
 * The 'override' decorator asserts that the current class member is a specialized instance of
 * an ancestor class's member of the same name
 */
export default class OverrideDecorator extends MemberDecorator {
    /**
     * Checks the features of the class for missing override decorators
     *
     * @param Clazz - The class constructor
     */
    static checkOverrides(Clazz: Constructor<any>): void {
        let proto = Clazz.prototype;
        if(proto == null) {
            return;
        }

        let registry = MemberDecorator.getOrCreateRegistry(Clazz),
            featureNames = MemberDecorator.featureNames(proto),
            ancestorFeatureNames = this.ancestorFeatureNames(proto);

        featureNames.forEach(featureName => {
            let registration = registry.get(featureName);
            checkedAssert(
                (registration != null && registration.overrides) || !ancestorFeatureNames.has(featureName),
                `@override decorator missing on ${Clazz.name}.${String(featureName)}`
            );
        });
    }

    /**
     * Returns an instance of the 'override' decorator in the specified mode.
     * When checkMode is true the decorator is enabled. When checkMode is false the decorator has no effect
     *
     * @param checkMode - A flag representing mode of the decorator
     */
    constructor(protected checkMode: boolean) {
        super(checkMode);
        this.override = this.override.bind(this);
    }

    /**
     * The override decorator specifies that the associated method replaces
     * a method of the same name in an ancestor class.
     */
    override(target: Function | object, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor {
        if(!this.checkMode) {
            return currentDescriptor;
        }

        let assert = this._assert,
            isStatic = typeof target == 'function',
            dw = new DescriptorWrapper(currentDescriptor);
        assert(!isStatic, MSG_NO_STATIC, TypeError);

        let am = MemberDecorator.ancestorFeature(target, propertyKey);
        assert(am != null && dw.memberType === am.memberType, MSG_NO_MATCHING_FEATURE);

        let Clazz = (target as any).constructor,
            registration = MemberDecorator.registerFeature(Clazz, propertyKey, dw);
        registration.overrides = checkedAssert(!registration.overrides, MSG_DUPLICATE_OVERRIDE);

        if(registration.descriptorWrapper.isMethod) {
            let thisMethod: Function = registration.descriptorWrapper.value,
                ancMethod: Function = am!.value;
            checkedAssert(thisMethod.length == ancMethod.length, MSG_INVALID_ARG_LENGTH);
        }

        return currentDescriptor;
    }
}