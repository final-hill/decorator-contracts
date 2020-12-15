/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

class DescriptorWrapper {
    constructor(public descriptor: PropertyDescriptor) {}

    get hasGetter(): boolean {
        return this.isAccessor && this.descriptor!.get != undefined;
    }

    get hasSetter(): boolean {
        return this.isAccessor && this.descriptor!.set != undefined;
    }

    /**
     * Determines if the descriptor describes a property
     */
    get isProperty(): boolean {
        return !['function', 'undefined'].includes(typeof this.descriptor.value);
    }

    /**
     * Determines if the descriptor describes a method
     */
    get isMethod(): boolean {
        return typeof this.descriptor!.value == 'function';
    }

    /**
     * Determines if the descriptor describes an accessor
     */
    get isAccessor(): boolean {
        return typeof this.descriptor!.value == 'undefined';
    }

    /**
     * A string identifier of the type of descriptor
     */
    get memberType(): 'method' | 'property' | 'accessor' {
        return this.isMethod ? 'method' :
            this.isProperty ? 'property' :
                'accessor';
    }

    get value(): any {
        return this.descriptor.value;
    }
}

export default DescriptorWrapper;