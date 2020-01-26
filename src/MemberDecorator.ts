/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import DescriptorWrapper from './lib/DescriptorWrapper';
import AssertionError from './AssertionError';
import { DECORATOR_REGISTRY, DecoratorRegistry, IDecoratorRegistration } from './lib/DecoratorRegistry';
import { RequireType } from './RequiresDecorator';
import getAncestry from './lib/getAncestry';
import Constructor from './typings/Constructor';
import { DecoratedConstructor } from './typings/DecoratedConstructor';

export const MSG_NO_STATIC = `Only instance members can be decorated, not static members`;
export const MSG_DECORATE_METHOD_ACCESSOR_ONLY = `Only methods and accessors can be decorated.`;
export const MSG_INVARIANT_REQUIRED = 'An @invariant must be defined on the current class or one of its ancestors';
export const MSG_INVALID_DECORATOR = 'Invalid decorator declaration';
const FN_TRUE: RequireType = () => true;

function fnInvariantRequired(): void {
    throw new AssertionError(MSG_INVARIANT_REQUIRED);
}

let checkedAssert = new Assertion(true).assert;

export default abstract class MemberDecorator {
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

        let registry = MemberDecorator.getOrCreateRegistry(proto.constructor),
            descriptorWrapper = registry.has(propertyKey) ?
                registry.get(propertyKey)!.descriptorWrapper :
                new DescriptorWrapper(Object.getOwnPropertyDescriptor(proto, propertyKey)!);

        return descriptorWrapper.hasDescriptor ? descriptorWrapper : this.ancestorFeature(proto, propertyKey);
    }

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
     * Returns the decorator registry defined in the current class.
     * If the registry is undefined, a new one is created
     *
     * @param Clazz
     */
    static getOrCreateRegistry(Clazz: Constructor<any>): DecoratorRegistry {
        return Object.getOwnPropertySymbols(Clazz).includes(DECORATOR_REGISTRY) ?
            (Clazz as DecoratedConstructor)[DECORATOR_REGISTRY]! :
            (Clazz as DecoratedConstructor)[DECORATOR_REGISTRY] = new DecoratorRegistry();
    }

    /**
     *
     * @param Clazz
     * @param propertyKey
     * @param descriptorWrapper
     */
    static registerFeature(Clazz: Constructor<any>, propertyKey: PropertyKey, descriptorWrapper: DescriptorWrapper): IDecoratorRegistration {
        let decoratorRegistry = this.getOrCreateRegistry(Clazz),
            registration = decoratorRegistry.getOrCreate(propertyKey, {...descriptorWrapper.descriptor});

        // Potentially undefined in pre ES5 environments (compilation target)
        checkedAssert(descriptorWrapper.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
        checkedAssert(descriptorWrapper.isMethod || descriptorWrapper.isAccessor, MSG_DECORATE_METHOD_ACCESSOR_ONLY);

        if(descriptorWrapper.isMethod) {
            descriptorWrapper.descriptor!.value = fnInvariantRequired;
        } else {
            if(descriptorWrapper.hasGetter) {
                descriptorWrapper.descriptor!.get = fnInvariantRequired;
            }
            if(descriptorWrapper.hasGetter) {
                descriptorWrapper.descriptor!.set = fnInvariantRequired;
            }
        }

        return registration;
    }

    static getAncestorRegistration(Clazz: Constructor<any>, propertyKey: PropertyKey) {
        let Base = Object.getPrototypeOf(Clazz),
            ancestry = getAncestry(Base),
            AncestorRegistryClazz = ancestry.find(Clazz =>
                this.getOrCreateRegistry(Clazz).has(propertyKey)
            ),
            ancestorRegistry = AncestorRegistryClazz != null ? this.getOrCreateRegistry(AncestorRegistryClazz) : null;

        return ancestorRegistry?.get(propertyKey);
    }

    /**
     * Decorated class features are replaced with the fnInvariantRequired definition.
     * This method restores the original descriptor.
     *
     * @param Clazz
     */
    static restoreFeatures(Clazz: Constructor<any>): void {
        let proto = Clazz.prototype;
        if(proto == null) {
            return;
        }

        let registry = this.getOrCreateRegistry(Clazz);
        // FIXME: Good._inRange is _fnInvariantRequired. why?
        registry.forEach((registration, propertyKey) => {
            let {descriptorWrapper} = registration,
                ancRegistration = registration.requires != undefined ? undefined : this.getAncestorRegistration(Clazz, propertyKey),
                requires = registration.requires ?? ancRegistration?.requires ?? FN_TRUE,
                originalDescriptor = descriptorWrapper.descriptor!,
                newDescriptor = {...originalDescriptor},
                requiresError = `Precondition failed on ${Clazz.name}.${String(propertyKey)}`;

            if(descriptorWrapper.isMethod) {
                let method: Function = originalDescriptor.value;
                newDescriptor.value = function(...args: any[]) {
                    checkedAssert(requires!.apply(this, args), requiresError);

                    return method.apply(this, args);
                };
            } else {
                if(descriptorWrapper.hasGetter) {
                    let getter: Function = originalDescriptor.get!;
                    newDescriptor.get = function() {
                        checkedAssert(requires!.apply(this), requiresError);

                        return getter.apply(this);
                    };
                }
                if(descriptorWrapper.hasSetter) {
                    let setter: Function = originalDescriptor.set!;
                    newDescriptor.set = function(value: any) {
                        checkedAssert(requires!.apply(this), requiresError);
                        setter.call(this, value);
                    };
                }
            }

            Object.defineProperty(proto, propertyKey, newDescriptor);
        });
    }

    protected _assert: typeof Assertion.prototype.assert;
    protected _checkedAssert = new Assertion(true).assert;
    protected _uncheckedAssert = new Assertion(false).assert;

    /**
     * Returns an instance of the decorator in the specified mode.
     * When checkMode is true the decorator is enabled.
     * When checkMode is false the decorator has no effect
     *
     * @param checkMode - A flag representing mode of the decorator
     */
    constructor(protected checkMode: boolean) {
        this._assert = checkMode ? this._checkedAssert : this._uncheckedAssert;
    }
}