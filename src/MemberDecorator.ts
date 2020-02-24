/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import DescriptorWrapper from './lib/DescriptorWrapper';
import AssertionError from './AssertionError';
import { DECORATOR_REGISTRY, DecoratorRegistry, IDecoratorRegistration } from './lib/DecoratorRegistry';
import { PredicateType } from './DemandsDecorator';
import getAncestry from './lib/getAncestry';
import Constructor from './typings/Constructor';
import { DecoratedConstructor } from './typings/DecoratedConstructor';

export const MSG_NO_STATIC = `Only instance members can be decorated, not static members`;
export const MSG_DECORATE_METHOD_ACCESSOR_ONLY = `Only methods and accessors can be decorated.`;
export const MSG_INVARIANT_REQUIRED = 'An @invariant must be defined on the current class or one of its ancestors';
export const MSG_INVALID_DECORATOR = 'Invalid decorator declaration';

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
     * Tracks the provided class feauture in a registry defined on the class
     * and then replaces it with an error throwing placeholder until the
     * invariant decorator can restore it
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

    static getAllAncestorDemands(Class: Constructor<any>, propertyKey: PropertyKey): PredicateType[][] {
        let Base = Object.getPrototypeOf(Class),
            ancestry = getAncestry(Base),
            ancestorRegistrations = ancestry.filter(Class =>
                this.getOrCreateRegistry(Class).has(propertyKey)
            ).map(Class => this.getOrCreateRegistry(Class).get(propertyKey)!);

        return ancestorRegistrations
            .filter(reg => reg.demands.length > 0)
            .map(reg => reg.demands);
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
        registry.forEach((registration, propertyKey) => {
            let {descriptorWrapper} = registration,
                allAncDemands = this.getAllAncestorDemands(Clazz, propertyKey),
                allDemands = registration.demands.length > 0 ? [registration.demands, ...allAncDemands] : allAncDemands,
                originalDescriptor = descriptorWrapper.descriptor!,
                newDescriptor = {...originalDescriptor},
                // TODO: more specific error. Want the specific class name, feature name, and expression
                demandsError = `Precondition failed on ${Clazz.name}.prototype.${String(propertyKey)}`;

            let checkedFeature = (feature: Function) => function(this: typeof newDescriptor, ...args: any[]) {
                if(allDemands.length > 0) {
                    checkedAssert(
                        allDemands.some(
                            demands => demands.every(
                                demand => demand.apply(this, args)
                            )
                        ),
                        demandsError
                    );
                }

                return feature.apply(this, args);
            };

            if(descriptorWrapper.isMethod) {
                let feature: Function = originalDescriptor.value;
                newDescriptor.value = checkedFeature(feature);
            } else if(descriptorWrapper.hasGetter) {
                let feature: Function = originalDescriptor.get!;
                newDescriptor.get = checkedFeature(feature);
            } else if(descriptorWrapper.hasSetter) {
                let feature: Function = originalDescriptor.set!;
                newDescriptor.set = checkedFeature(feature);
            } else {
                throw new Error(`Unhandled condition. Unable to restore ${Clazz.name}.prototype.${String(propertyKey)}`);
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