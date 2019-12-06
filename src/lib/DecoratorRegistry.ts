/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import DescriptorWrapper from './DescriptorWrapper';
import { RequireType } from '../RequiresDecorator';

export const DECORATOR_REGISTRY = Symbol('Decorator Registry');

export interface IDecoratorRegistration {
    descriptorWrapper: DescriptorWrapper
    overrides: boolean
    hasRequires: boolean
    requires?: RequireType
}

export class DecoratorRegistry extends Map<PropertyKey, IDecoratorRegistration> {
    getOrCreate(propertyKey: PropertyKey, descriptor: PropertyDescriptor): IDecoratorRegistration {
        if(!this.has(propertyKey)) {
            this.set(propertyKey, {
                descriptorWrapper: new DescriptorWrapper(descriptor),
                hasRequires: false,
                overrides: false
            });
        }

        return this.get(propertyKey)!;
    }
}