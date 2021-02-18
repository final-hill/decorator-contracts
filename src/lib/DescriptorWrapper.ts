/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

class DescriptorWrapper {
    get hasDescriptor(): boolean {
        return this.descriptor != undefined;
    }

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
        return this.hasDescriptor ?
            typeof this.descriptor!.value != 'function' &&
                    typeof this.descriptor!.value != 'undefined' :
            false;
    }

    /**
     * Determines if the descriptor describes a method
     */
    get isMethod(): boolean {
        return this.hasDescriptor ?
            typeof this.descriptor!.value == 'function' :
            false;
    }

    /**
     * Determines if the descriptor describes an accessor
     */
    get isAccessor(): boolean {
        return this.hasDescriptor ?
            typeof this.descriptor!.value == 'undefined' :
            false;
    }

    get memberType(): 'method' | 'property' | 'accessor' {
        return this.isMethod ? 'method' :
            this.isProperty ? 'property' :
                'accessor';
    }

    get value(): any {
        return this.hasDescriptor ? this.descriptor!.value : undefined;
    }

    // TODO: why allow undefined?
    constructor(public descriptor: PropertyDescriptor | undefined) {}
}

export default DescriptorWrapper;