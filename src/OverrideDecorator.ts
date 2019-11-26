/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import DescriptorWrapper from './lib/DescriptorWrapper';
import MemberDecorator, { MSG_NO_STATIC, MSG_DECORATE_METHOD_ACCESSOR_ONLY } from './MemberDecorator';
import Assertion from './Assertion';

export const OVERRIDE_LIST = Symbol('Override List');
export const MSG_INVALID_ARG_LENGTH = `An overridden method must have the same number of parameters as its ancestor method`;
export const MSG_NO_MATCHING_FEATURE = `This feature does not override an ancestor feature.`;
export const MSG_DUPLICATE_OVERRIDE = `Only a single @override decorator can be assigned to a class member`;

let checkedAssert = new Assertion(true).assert;

interface IDecorated {
    [OVERRIDE_LIST]?: Set<PropertyKey>
}

/**
 * The 'override' decorator asserts that the current class member is a specialized instance of
 * an ancestor class's member of the same name
 */
export default class OverrideDecorator extends MemberDecorator {
    static checkOverrides(Clazz: Function & IDecorated): void {
        let proto = Clazz.prototype;
        if(proto == null) {
            return;
        }
        let clazzSymbols = Object.getOwnPropertySymbols(Clazz),
            featureNames = OverrideDecorator.featureNames(proto);

        let overrides: Set<PropertyKey> = clazzSymbols.includes(OVERRIDE_LIST) ?
                Clazz[OVERRIDE_LIST]! : new Set(),
            ancestorFeatureNames = this.ancestorFeatureNames(proto);

        featureNames.forEach(featureName =>
            checkedAssert(
                overrides.has(featureName) || !ancestorFeatureNames.has(featureName),
                `@override decorator missing on ${Clazz.name}.${String(featureName)}`
            )
        );
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

        // Potentially undefined in pre ES5 environments (compilation target)
        assert(dw.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
        assert(!isStatic, MSG_NO_STATIC, TypeError);
        assert(dw.isMethod || dw.isProperty || dw.isAccessor);

        let am = OverrideDecorator.ancestorFeature(target, propertyKey);
        assert(am != null && dw.memberType === am.memberType, MSG_NO_MATCHING_FEATURE);

        let Clazz = (target as any).constructor,
            overrides = Object.getOwnPropertySymbols(Clazz).includes(OVERRIDE_LIST) ?
                Clazz[OVERRIDE_LIST]! : Clazz[OVERRIDE_LIST] = new Set();

        assert(!overrides.has(propertyKey), MSG_DUPLICATE_OVERRIDE);
        overrides.add(propertyKey);

        if(dw.isMethod) {
            let thisMethod: Function = dw.value,
                ancMethod: Function = am!.value;
            assert(thisMethod.length == ancMethod.length, MSG_INVALID_ARG_LENGTH);
        }

        // TODO: subtyping assertions?
        // TODO: writable | configurable | enumerable verification

        return dw.descriptor!;
    }
}