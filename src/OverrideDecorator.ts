/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import DescriptorWrapper from './lib/DescriptorWrapper';
import MemberDecorator, { MSG_NO_STATIC } from './MemberDecorator';
import Assertion from './Assertion';
import type {Constructor} from './typings/Constructor';
import { CLASS_REGISTRY } from './lib/CLASS_REGISTRY';

export const MSG_INVALID_ARG_LENGTH = 'An overridden method must have the same number of parameters as its ancestor method';
export const MSG_NO_MATCHING_FEATURE = 'This feature does not override an ancestor feature.';
export const MSG_DUPLICATE_OVERRIDE = 'Only a single @override decorator can be assigned to a class member';

const checkedAssert: Assertion['assert'] = new Assertion(true).assert;

/**
 * The 'override' decorator asserts that the current class feautre is a specialization or
 * replacement of an ancestor class's feature of the same name and argument count
 */
export default class OverrideDecorator extends MemberDecorator {
    /**
     * Returns an instance of the 'override' decorator in the specified mode.
     * When checkMode is true the decorator is enabled. When checkMode is false the decorator has no effect
     *
     * @param {boolean} checkMode - A flag representing mode of the decorator
     */
    constructor(protected checkMode: boolean) {
        super(checkMode);
        this.override = this.override.bind(this);
    }

    /**
     * Checks the features of the class for missing override decorators
     *
     * @param {Constructor<any>} Class - The class constructor
     */
    static checkOverrides(Class: Constructor<any>): void {
        const proto = Class.prototype;
        if(proto == null) {
            return;
        }

        const {featureRegistry} = CLASS_REGISTRY.getOrCreate(Class),
            featureNames = MemberDecorator.featureNames(proto),
            ancestorFeatureNames = this.ancestorFeatureNames(proto);

        featureNames.forEach(featureName => {
            const registration = featureRegistry.get(featureName);
            checkedAssert(
                (registration != null && registration.overrides) || !ancestorFeatureNames.has(featureName),
                `@override decorator missing on ${Class.name}.${String(featureName)}`
            );
        });
    }

    /**
     * The 'override' decorator asserts that the current class feautre is a specialization or
     * replacement of an ancestor class's feature of the same name and argument count
     *
     * @param {object} target - The class
     * @param {PropertyKey} propertyKey - The property key
     * @param {PropertyDescriptor} descriptor - The property descriptor
     * @returns {PropertyDescriptor} - The PropertyDescriptor
     */
    override(target: object, propertyKey: PropertyKey, descriptor: PropertyDescriptor): PropertyDescriptor {
        if(!this.checkMode) {
            return descriptor;
        }

        const assert: Assertion['assert'] = this._assert,
            isStatic = typeof target == 'function',
            dw = new DescriptorWrapper(descriptor);
        assert(!isStatic, MSG_NO_STATIC, TypeError);

        const am = MemberDecorator.ancestorFeature(target, propertyKey);
        assert(am != null && dw.memberType === am.memberType, MSG_NO_MATCHING_FEATURE);

        const Clazz = (target as any).constructor,
            registration = MemberDecorator.registerFeature(Clazz, propertyKey, dw);
        checkedAssert(!registration.overrides, MSG_DUPLICATE_OVERRIDE);
        registration.overrides = true;

        if(registration.descriptorWrapper.isMethod) {
            const thisMethod: Function = registration.descriptorWrapper.value,
                ancMethod: Function = am!.value;
            checkedAssert(thisMethod.length == ancMethod.length, MSG_INVALID_ARG_LENGTH);
        }

        return descriptor;
    }
}