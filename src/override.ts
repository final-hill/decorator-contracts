/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import Assertion from './Assertion';
import { MSG_NO_STATIC, MSG_NO_MATCHING_FEATURE, MSG_DUPLICATE_OVERRIDE, MSG_INVALID_ARG_LENGTH } from './Messages';
import CLASS_REGISTRY from './lib/CLASS_REGISTRY';

const assert: Assertion['assert'] = new Assertion(true).assert;

/**
 * The 'override' decorator asserts that the current class feature is a specialization or
 * replacement of an ancestor class's feature of the same name and argument count
 *
 * @param {object} target - The class
 * @param {PropertyKey} propertyKey - The property key
 * @param {PropertyDescriptor} descriptor - The property descriptor
 * @returns {PropertyDescriptor} - The PropertyDescriptor
 */
function override(target: object, propertyKey: PropertyKey, descriptor: PropertyDescriptor): PropertyDescriptor {
    const Class = (target as any).constructor,
          isStatic = typeof target == 'function';

    assert(!isStatic, MSG_NO_STATIC, TypeError);

    const registration = CLASS_REGISTRY.getOrCreate(Class),
          feature = registration.features.find(feature => feature.key === propertyKey)!,
          ancFeature = feature.ancestorFeature;

    assert(ancFeature != null && feature.memberType === ancFeature.memberType, MSG_NO_MATCHING_FEATURE);
    assert(!feature.hasOverrides, MSG_DUPLICATE_OVERRIDE);
    feature.hasOverrides = true;

    if(feature.isMethod) {
        const thisMethod: Function = feature.value,
            ancMethod: Function = ancFeature.value;
        assert(thisMethod.length == ancMethod.length, MSG_INVALID_ARG_LENGTH);
    }

    return descriptor;
}

export default override;