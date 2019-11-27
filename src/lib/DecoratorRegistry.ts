/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import DescriptorWrapper from './DescriptorWrapper';

export const DECORATOR_REGISTRY = Symbol('Decorator Registry');

export interface IDecoratorRegistration {
    overrides: boolean
    descriptor: DescriptorWrapper
}

export class DecoratorRegistry extends Map<PropertyKey, IDecoratorRegistration> {
    getOrCreate(propertyKey: PropertyKey, descriptor: PropertyDescriptor): IDecoratorRegistration {
        if(!this.has(propertyKey)) {
            this.set(propertyKey, {overrides: false, descriptor: new DescriptorWrapper(descriptor)});
        }

        return this.get(propertyKey)!;
    }
}