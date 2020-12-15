/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import CLASS_REGISTRY from './CLASS_REGISTRY';
import DescriptorWrapper from './DescriptorWrapper';

/**
 * Finds the nearest ancestor feature for the given propertyKey by walking the prototype chain of the target
 *
 * @param {any} targetProto - The prototype of the object
 * @param {PropertyKey} propertyKey - The name of the feature to search for
 * @returns {DescriptorWrapper | null} = The DescriptorWrapper if it exists
 */
function ancestorFeature(targetProto: any, propertyKey: PropertyKey): DescriptorWrapper | null {
    const proto = Object.getPrototypeOf(targetProto);
    if(proto == null) {
        return null;
    }

    const {featureRegistry} = CLASS_REGISTRY.getOrCreate(proto.constructor),
        descriptorWrapper = featureRegistry.has(propertyKey) ?
            featureRegistry.get(propertyKey)!.descriptorWrapper :
            new DescriptorWrapper(Object.getOwnPropertyDescriptor(proto, propertyKey)!);

    return descriptorWrapper.hasDescriptor ? descriptorWrapper : this.ancestorFeature(proto, propertyKey);
}

export default ancestorFeature;