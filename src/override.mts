/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { assert } from './index.mjs';
import { Messages } from './Messages.mjs';
import { CLASS_REGISTRY } from './lib/index.mjs';
import { isContracted } from './Contracted.mjs';

/**
 * The 'override' decorator asserts that the current class feature is a specialization or
 * replacement of an ancestor class's feature of the same name and argument count
 *
 * @param {object} target - The class
 * @param {PropertyKey} propertyKey - The property key
 * @param {PropertyDescriptor} descriptor - The property descriptor
 * @returns {PropertyDescriptor} - The PropertyDescriptor
 */
function override(target: Record<PropertyKey, any>, propertyKey: PropertyKey, descriptor: PropertyDescriptor): PropertyDescriptor {
    const Class = (target as any).constructor,
        isStatic = typeof target == 'function';

    assert(!isStatic, Messages.MsgNoStatic, TypeError);

    const registration = CLASS_REGISTRY.getOrCreate(Class),
        feature = registration.findFeature(propertyKey);

    assert(feature != null, `${Messages.MsgMissingFeature}: ${registration.Class.name}.prototype.${String(propertyKey)}`);

    const ancFeature = feature.ancestorFeature;

    assert(
        ancFeature != null && feature.memberType === ancFeature.memberType,
        `${Messages.MsgNoMatchingFeature} '${registration.Class.name}.prototype.${String(propertyKey)}'`
    );
    assert(!feature.hasOverrides, Messages.MsgDuplicateOverride);
    feature.hasOverrides = true;

    if (feature.isMethod) {
        const thisMethod: (...args: any[]) => any = feature.value,
            ancMethod: (...args: any[]) => any = ancFeature.value;
        assert(thisMethod.length == ancMethod.length, Messages.MsgInvalidArgLength);
    }

    feature.overriddenOriginalDescriptor = descriptor;

    // method decorators are evaluated before class decorators
    return {
        enumerable: true,
        configurable: true,
        ...(!feature.isAccessor ? { writable: true } : {}),
        ...(feature.hasGetter ? { get() { assert((this.constructor as any)[isContracted], Messages.MsgNotContracted); } } : {}),
        ...(feature.hasSetter ? { set() { assert((this.constructor as any)[isContracted], Messages.MsgNotContracted); } } : {}),
        ...(feature.isMethod ? { value() { assert((this.constructor as any)[isContracted], Messages.MsgNotContracted); } } : {})
    };
}

export default override;