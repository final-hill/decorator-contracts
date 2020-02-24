/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import DescriptorWrapper from './DescriptorWrapper';
import { PredicateType } from '../DemandsDecorator';

export const DECORATOR_REGISTRY = Symbol('Decorator Registry');

export interface IDecoratorRegistration {
    descriptorWrapper: DescriptorWrapper
    overrides: boolean
    demands: PredicateType[]
}

export class DecoratorRegistry extends Map<PropertyKey, IDecoratorRegistration> {
    getOrCreate(propertyKey: PropertyKey, descriptor: PropertyDescriptor): IDecoratorRegistration {
        if(!this.has(propertyKey)) {
            this.set(propertyKey, {
                demands: [],
                descriptorWrapper: new DescriptorWrapper(descriptor),
                overrides: false
            });
        }

        return this.get(propertyKey)!;
    }
}