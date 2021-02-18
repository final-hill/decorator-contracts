/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {assert} from './';
import { MSG_NO_STATIC, MSG_NO_MATCHING_FEATURE, MSG_DUPLICATE_OVERRIDE, MSG_INVALID_ARG_LENGTH, MSG_NOT_CONTRACTED } from './Messages';
import CLASS_REGISTRY from './lib/CLASS_REGISTRY';
import { isContracted } from './Contracted';

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

    assert(!isStatic, MSG_NO_STATIC, TypeError);
    assert(Class[isContracted], MSG_NOT_CONTRACTED);

    const registration = CLASS_REGISTRY.getOrCreate(Class),
          feature = registration.features.find(feature => feature.name === propertyKey)!,
          ancFeature = feature.ancestorFeature;

    assert(ancFeature != null && feature.memberType === ancFeature.memberType, MSG_NO_MATCHING_FEATURE);
    assert(!feature.hasOverrides, MSG_DUPLICATE_OVERRIDE);
    feature.hasOverrides = true;

    if(feature.isMethod) {
        const thisMethod: (...args: any[]) => any = feature.value,
            ancMethod: (...args: any[]) => any = ancFeature.value;
        assert(thisMethod.length == ancMethod.length, MSG_INVALID_ARG_LENGTH);
    }

    return descriptor;
}

export default override;