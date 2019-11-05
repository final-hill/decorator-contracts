/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

/**
 * DescriptorWrapper is a utility class for inspecting
 * the native PropertyDescriptor
 */
class DescriptorWrapper {
    /**
     * Determines if the descriptor describes a property
     */
    get isProperty() {
        return typeof this.descriptor.value != 'function' &&
               typeof this.descriptor.value != 'undefined';
    }

    /**
     * Determines if the descriptor describes a method
     */
    get isMethod() {
        return typeof this.descriptor.value == 'function';
    }

    /**
     * Determines if the descriptor describes an accessor
     */
    get isAccessor() {
        return typeof this.descriptor.value == 'undefined';
    }

    get memberType(): 'method' | 'property' | 'accessor' {
        return this.isMethod ? 'method' :
               this.isProperty ? 'property' :
               'accessor';
    }

    get value() {
        return this.descriptor.value;
    }

    constructor(public descriptor: PropertyDescriptor) {}
}

export default DescriptorWrapper;