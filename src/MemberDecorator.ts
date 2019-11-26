/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import DescriptorWrapper from './lib/DescriptorWrapper';

export const MSG_NO_STATIC = `Only instance members can be decorated, not static members`;
export const MSG_DECORATE_METHOD_ACCESSOR_ONLY = `Only methods and accessors can be decorated.`;
export const MSG_INVARIANT_REQUIRED = 'An @invariant must be defined on the current class or one of its ancestors';

export default abstract class MemberDecorator {
    /**
     * Returns the feature names defined on the provided prototype and its ancestors
     */
    static ancestorFeatureNames(targetProto: any): Set<PropertyKey> {
        if(targetProto == null) {
            return new Set();
        }
        let proto = Object.getPrototypeOf(targetProto);

        return proto == null ? new Set() :
            new Set([...this.featureNames(proto), ...this.ancestorFeatureNames(proto)]);
    }

    /**
     * Returns the feature names associated with the provided prototype
     */
    static featureNames(proto: object): Set<PropertyKey> {
        return proto == null ? new Set() : new Set(
            Object.entries(Object.getOwnPropertyDescriptors(proto))
            .filter(([key, descriptor]) => {
                let dw = new DescriptorWrapper(descriptor);

                return (dw.isMethod || dw.isAccessor) && key != 'constructor';
            })
            .map(([key, _]) => key)
        );
    }

    /**
     * Finds the nearest ancestor feature for the given propertyKey by walking the prototype chain of the target
     *
     * @param assert - The assertion implementation
     * @param targetProto - The prototype of the object
     * @param propertyKey - The name of the feature to search for
     */
    static ancestorFeature(targetProto: any, propertyKey: PropertyKey): DescriptorWrapper | null {
        let proto = Object.getPrototypeOf(targetProto);
        if(proto == null) {
            return null;
        }
        let ancestorFeature = Object.getOwnPropertyDescriptor(proto, propertyKey);

        return ancestorFeature != undefined ? new DescriptorWrapper(ancestorFeature) : this.ancestorFeature(proto, propertyKey);
    }

    protected _assert: typeof Assertion.prototype.assert;
    protected _checkedAssert = new Assertion(true).assert;
    protected _uncheckedAssert = new Assertion(false).assert;

    /**
     * Returns an instance of the decorator in the specified mode.
     * When debugMode is true the decorator is enabled.
     * When debugMode is false the decorator has no effect
     *
     * @param debugMode - A flag representing mode of the decorator
     */
    constructor(protected debugMode: boolean) {
        this._assert = debugMode ? this._checkedAssert : this._uncheckedAssert;
    }
}