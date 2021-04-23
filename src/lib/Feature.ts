/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import ClassRegistration from './ClassRegistration';

class Feature {
    #descriptor: PropertyDescriptor;

    /**
     * Does the current feature have an @override declaration?
     */
    hasOverrides = false;

    constructor(readonly classRegistration: ClassRegistration, readonly name: PropertyKey, descriptor: PropertyDescriptor){
        this.#descriptor = descriptor;
    }

    /**
     * Finds the nearest ancestor feature of the same key if it exists
     */
    get ancestorFeature(): Feature | null {
        return this.classRegistration.ancestryFeatures().filter(feature => feature.name === this.name)[0];
    }

    /**
     * Returns a reference to the descriptor
     */
    get descriptor() {
        return this.#descriptor;
    }

    /**
     * Updates the descriptor
     * @param {PropertyDescriptor} desc - The new descriptor
     */
    set descriptor(desc: PropertyDescriptor) {
        this.#descriptor = desc;
    }

    /**
     * Returns a reference to the getter if it exists
     */
    get getter() {
        return this.#descriptor.get;
    }

    /**
     * Determines if the feature is an accessor with a getter defined
     */
    get hasGetter(): boolean {
        return this.isAccessor && this.#descriptor.get != undefined;
    }

    /**
     * Determines if the feature is an accessor with a setter defined
     */
    get hasSetter(): boolean {
        return this.isAccessor && this.#descriptor.set != undefined;
    }

    /**
     * Determines if the feature is a property
     */
    get isProperty(): boolean {
        return typeof this.#descriptor.value != 'function' &&
                typeof this.#descriptor.value != 'undefined';
    }

    /**
     * Determines if the feature is a method
     */
    get isMethod(): boolean {
        return typeof this.#descriptor.value == 'function';
    }

    /**
     * Determines if the feature is an accessor
     */
    get isAccessor(): boolean {
        return typeof this.#descriptor.value == 'undefined';
    }

    /**
     * Returns a string representing the type of feature.
     * @returns {string} 'method' | 'property' | 'accessor'
     */
    get memberType(): 'method' | 'property' | 'accessor' {
        return this.isMethod ? 'method' :
            this.isProperty ? 'property' :
                'accessor';
    }

    /**
     * Returns a reference to the setter if it exists
     */
    get setter() {
        return this.#descriptor.set;
    }

    /**
     * If the feature is a method, returns a reference to the implementation.
     * If the feature is a property, returns the value of the property
     * Otherwise returns undefined
     */
    get value(): any {
        return this.#descriptor.value;
    }
}

export default Feature;