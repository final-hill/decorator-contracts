/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import CLASS_REGISTRY from './CLASS_REGISTRY';
import Assertion from '../Assertion';
import DescriptorWrapper from './DescriptorWrapper';

const assert: Assertion['assert'] = new Assertion(true).assert;

/**
  * Tracks the provided class feature in a registry defined on the class
  * and then replaces it with an error throwing placeholder until the
  * invariant decorator can restore it
  *
  * @param {Constructor<any>} Class - The class
  * @param {PropertyKey} propertyKey - The property key
  * @param {DescriptorWrapper} descriptorWrapper - The DescriptorWrapper
  * @returns {FeatureRegistration} - The Decorator Registration
  */
function registerFeature(Class: Constructor<any>, propertyKey: PropertyKey, descriptorWrapper: DescriptorWrapper): FeatureRegistration {
    const { featureRegistry } = CLASS_REGISTRY.getOrCreate(Class),
        registration = featureRegistry.getOrCreate(propertyKey, { ...descriptorWrapper.descriptor });

    // Potentially undefined in pre ES5 environments (compilation target)
    assert(descriptorWrapper.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
    assert(descriptorWrapper.isMethod || descriptorWrapper.isAccessor, MSG_DECORATE_METHOD_ACCESSOR_ONLY);

    if (descriptorWrapper.isMethod) {
        descriptorWrapper.descriptor!.value = fnInvariantRequired;
    } else if (descriptorWrapper.isAccessor) {
        if (descriptorWrapper.hasGetter) {
            descriptorWrapper.descriptor!.get = fnInvariantRequired;
        }
        if (descriptorWrapper.hasSetter) {
            descriptorWrapper.descriptor!.set = fnInvariantRequired;
        }
    } else {
        throw new Error(`Unhandled condition. Unable to register ${Class.name}.prototype.${String(propertyKey)}`);
    }

    return registration;
}

export default registerFeature;