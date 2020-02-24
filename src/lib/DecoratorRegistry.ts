/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import DescriptorWrapper from './DescriptorWrapper';
import PredicateType from '../typings/PredicateType';

export const DECORATOR_REGISTRY = Symbol('Decorator Registry');

export interface IDecoratorRegistration {
    descriptorWrapper: DescriptorWrapper
    overrides: boolean
    demands: PredicateType[]
    ensures: PredicateType[]
}

export class DecoratorRegistry extends Map<PropertyKey, IDecoratorRegistration> {
    getOrCreate(propertyKey: PropertyKey, descriptor: PropertyDescriptor): IDecoratorRegistration {
        if(!this.has(propertyKey)) {
            this.set(propertyKey, {
                demands: [],
                ensures: [],
                descriptorWrapper: new DescriptorWrapper(descriptor),
                overrides: false
            });
        }

        return this.get(propertyKey)!;
    }
}