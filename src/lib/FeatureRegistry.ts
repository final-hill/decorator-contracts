/*!
 * @license
 * Copyright (C) 2020 Michael L Haufe
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import DescriptorWrapper from './DescriptorWrapper';
import { PredicateType } from '../typings/PredicateType';
import { RescueType } from '../typings/RescueType';
import { EnsuresType } from 'typings/EnsuresType';

export const DECORATOR_REGISTRY = Symbol('Decorator Registry');

export class FeatureRegistration {
    readonly demands: PredicateType<any>[] = [];
    descriptorWrapper: DescriptorWrapper;
    readonly ensures: EnsuresType<any>[] = [];
    overrides = false;
    rescue: RescueType<any> | undefined;

    constructor(descriptor: PropertyDescriptor){
        this.descriptorWrapper = new DescriptorWrapper(descriptor);
    }
}

export class FeatureRegistry extends Map<PropertyKey, FeatureRegistration> {
    getOrCreate(propertyKey: PropertyKey, descriptor: PropertyDescriptor): FeatureRegistration {
        if(!this.has(propertyKey)) {
            this.set(propertyKey, new FeatureRegistration(descriptor));
        }

        return this.get(propertyKey)!;
    }
}