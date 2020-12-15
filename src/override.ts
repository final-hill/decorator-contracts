/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import DescriptorWrapper from './lib/DescriptorWrapper';
import Assertion from './Assertion';
import { MSG_NO_STATIC, MSG_NO_MATCHING_FEATURE, MSG_DUPLICATE_OVERRIDE, MSG_INVALID_ARG_LENGTH } from './Messages';


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
    const isStatic = typeof target == 'function',
        dw = new DescriptorWrapper(descriptor);

    assert(!isStatic, MSG_NO_STATIC, TypeError);

    const am = ancestorFeature(target, propertyKey);
    assert(am != null && dw.memberType === am.memberType, MSG_NO_MATCHING_FEATURE);

    const Clazz = (target as any).constructor,
        registration = registerFeature(Clazz, propertyKey, dw);
    assert(!registration.overrides, MSG_DUPLICATE_OVERRIDE);
    registration.overrides = true;

    if(registration.descriptorWrapper.isMethod) {
        const thisMethod: Function = registration.descriptorWrapper.value,
            ancMethod: Function = am!.value;
        assert(thisMethod.length == ancMethod.length, MSG_INVALID_ARG_LENGTH);
    }

    return descriptor;
}

export default override;