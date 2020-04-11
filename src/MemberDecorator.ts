/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import Assertion from './Assertion';
import DescriptorWrapper from './lib/DescriptorWrapper';
import AssertionError from './AssertionError';
import { FeatureRegistration } from './lib/FeatureRegistry';
import getAncestry from './lib/getAncestry';
import type { Constructor } from './typings/Constructor';
import type { PredicateType } from './typings/PredicateType';
import { CLASS_REGISTRY } from './lib/CLASS_REGISTRY';

export const MSG_NO_STATIC = 'Only instance members can be decorated, not static members';
export const MSG_DECORATE_METHOD_ACCESSOR_ONLY = 'Only methods and accessors can be decorated.';
export const MSG_INVARIANT_REQUIRED = 'An @invariant must be defined on the current class or one of its ancestors';
export const MSG_INVALID_DECORATOR = 'Invalid decorator declaration';
export const MSG_SINGLE_RETRY = 'retry can only be called once';

/**
 * The default feature implementation until an invariant is
 * assigned to the class ancestry
 */
function fnInvariantRequired(): void {
    throw new AssertionError(MSG_INVARIANT_REQUIRED);
}

const checkedAssert: Assertion['assert'] = new Assertion(true).assert;

export default abstract class MemberDecorator {
    protected _assert: Assertion['assert'];
    protected _checkedAssert: Assertion['assert'] = new Assertion(true).assert;
    protected _uncheckedAssert: Assertion['assert'] = new Assertion(false).assert;

    /**
     * Returns an instance of the decorator in the specified mode.
     * When checkMode is true the decorator is enabled.
     * When checkMode is false the decorator has no effect
     *
     * @param {boolean} checkMode - A flag representing mode of the decorator
     */
    constructor(protected checkMode: boolean) {
        this._assert = checkMode ? this._checkedAssert : this._uncheckedAssert;
    }

    /**
     * Finds the nearest ancestor feature for the given propertyKey by walking the prototype chain of the target
     *
     * @param {any} targetProto - The prototype of the object
     * @param {PropertyKey} propertyKey - The name of the feature to search for
     * @returns {DescriptorWrapper | null} = The DescriptorWrapper if it exists
     */
    static ancestorFeature(targetProto: any, propertyKey: PropertyKey): DescriptorWrapper | null {
        const proto = Object.getPrototypeOf(targetProto);
        if(proto == null) {
            return null;
        }

        const {featureRegistry} = CLASS_REGISTRY.getOrCreate(proto.constructor),
            descriptorWrapper = featureRegistry.has(propertyKey) ?
                featureRegistry.get(propertyKey)!.descriptorWrapper :
                new DescriptorWrapper(Object.getOwnPropertyDescriptor(proto, propertyKey)!);

        return descriptorWrapper.hasDescriptor ? descriptorWrapper : this.ancestorFeature(proto, propertyKey);
    }

    /**
     * Returns the feature names defined on the provided prototype and its ancestors
     *
     * @param {object} targetProto - The prototype
     * @returns {Set<PropertyKey>} - The feature names
     */
    static ancestorFeatureNames(targetProto: object): Set<PropertyKey> {
        if(targetProto == null) {
            return new Set();
        }
        const proto = Object.getPrototypeOf(targetProto);

        return proto == null ? new Set() :
            new Set([...this.featureNames(proto), ...this.ancestorFeatureNames(proto)]);
    }

    /**
     * Returns the feature names associated with the provided prototype
     *
     * @param {object} proto - The prototype
     * @returns {Set<PropertyKey>} - The feature names
     */
    static featureNames(proto: object): Set<PropertyKey> {
        return proto == null ? new Set() : new Set(
            Object.entries(Object.getOwnPropertyDescriptors(proto))
                .filter(([key, descriptor]) => {
                    const dw = new DescriptorWrapper(descriptor);

                    return (dw.isMethod || dw.isAccessor) && key != 'constructor';
                })
                .map(([key]) => key)
        );
    }

    /**
     * Tracks the provided class feauture in a registry defined on the class
     * and then replaces it with an error throwing placeholder until the
     * invariant decorator can restore it
     *
     * @param {Constructor<any>} Class - The class
     * @param {PropertyKey} propertyKey - The property key
     * @param {DescriptorWrapper} descriptorWrapper - The DescriptorWrapper
     * @returns {FeatureRegistration} - The Decorator Registration
     */
    static registerFeature(Class: Constructor<any>, propertyKey: PropertyKey, descriptorWrapper: DescriptorWrapper): FeatureRegistration {
        const {featureRegistry} = CLASS_REGISTRY.getOrCreate(Class),
            registration = featureRegistry.getOrCreate(propertyKey, {...descriptorWrapper.descriptor});

        // Potentially undefined in pre ES5 environments (compilation target)
        checkedAssert(descriptorWrapper.hasDescriptor, MSG_DECORATE_METHOD_ACCESSOR_ONLY, TypeError);
        checkedAssert(descriptorWrapper.isMethod || descriptorWrapper.isAccessor, MSG_DECORATE_METHOD_ACCESSOR_ONLY);

        if(descriptorWrapper.isMethod) {
            descriptorWrapper.descriptor!.value = fnInvariantRequired;
        } else if(descriptorWrapper.isAccessor) {
            if(descriptorWrapper.hasGetter) {
                descriptorWrapper.descriptor!.get = fnInvariantRequired;
            }
            if(descriptorWrapper.hasSetter) {
                descriptorWrapper.descriptor!.set = fnInvariantRequired;
            }
        } else {
            throw new Error(`Unhandled condition. Unable to register ${Class.name}.prototype.${String(propertyKey)}`);
        }

        return registration;
    }

    static getAncestorRegistration(Class: Constructor<any>, propertyKey: PropertyKey): FeatureRegistration | undefined {
        const Base = Object.getPrototypeOf(Class),
            ancestry = getAncestry(Base),
            AncestorRegistryClass = ancestry.find(Class =>
                CLASS_REGISTRY.getOrCreate(Class).featureRegistry.has(propertyKey)
            ),
            ancestorRegistry = AncestorRegistryClass != null ? CLASS_REGISTRY.getOrCreate(AncestorRegistryClass).featureRegistry : null;

        return ancestorRegistry?.get(propertyKey);
    }

    // TODO unify these to methods and then deprecate by inlining.
    static getAllAncestorDemands(Class: Constructor<any>, propertyKey: PropertyKey): PredicateType[][] {
        const Base = Object.getPrototypeOf(Class),
            ancestry = getAncestry(Base),
            ancestorRegistrations = ancestry.filter(Class =>
                CLASS_REGISTRY.getOrCreate(Class).featureRegistry.has(propertyKey)
            ).map(Class => CLASS_REGISTRY.getOrCreate(Class).featureRegistry.get(propertyKey)!);

        return ancestorRegistrations
            .filter(reg => reg.demands.length > 0)
            .map(reg => reg.demands);
    }

    static getAllAncestorEnsures(Class: Constructor<any>, propertyKey: PropertyKey): PredicateType[][] {
        const Base = Object.getPrototypeOf(Class),
            ancestry = getAncestry(Base),
            ancestorRegistrations = ancestry.filter(Class =>
                CLASS_REGISTRY.getOrCreate(Class).featureRegistry.has(propertyKey)
            ).map(Class => CLASS_REGISTRY.getOrCreate(Class).featureRegistry.get(propertyKey)!);

        return ancestorRegistrations
            .filter(reg => reg.ensures.length > 0)
            .map(reg => reg.ensures);
    }

    /**
     * Decorated class features are replaced with the fnInvariantRequired definition.
     * This method restores the original descriptor.
     *
     * @param {Constructor<any>} Clazz - The class
     */
    static restoreFeatures(Clazz: Constructor<any>): void {
        const proto = Clazz.prototype;
        if(proto == null) {
            return;
        }

        // TODO: optimize
        const {featureRegistry} = CLASS_REGISTRY.getOrCreate(Clazz);
        featureRegistry.forEach((registration, propertyKey) => {
            const {descriptorWrapper} = registration,
                allAncDemands = this.getAllAncestorDemands(Clazz, propertyKey),
                allAncEnsures = this.getAllAncestorEnsures(Clazz, propertyKey),
                allDemands = registration.demands.length > 0 ? [registration.demands, ...allAncDemands] : allAncDemands,
                allEnsures = registration.ensures.length > 0 ? [registration.ensures, ...allAncEnsures] : allAncEnsures,
                fnRescue = registration.rescue,
                originalDescriptor = descriptorWrapper.descriptor!,
                newDescriptor = {...originalDescriptor},
                // TODO: more specific error. Want the specific class name, feature name, and expression
                demandsError = `Precondition failed on ${Clazz.name}.prototype.${String(propertyKey)}`,
                ensuresError = `Postcondition failed on ${Clazz.name}.prototype.${String(propertyKey)}`,

                checkedFeature = (feature: Function) => function _checkedFeature(this: typeof Clazz, ...args: any[]): any {
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

                    let result;
                    try {
                        result = feature.apply(this, args);
                        if(allEnsures.length > 0) {
                            checkedAssert(
                                allEnsures.every(
                                    ensures => ensures.every(
                                        ensure => ensure.apply(this, args)
                                    )
                                ),
                                ensuresError
                            );
                        }
                    } catch(error) {
                        if(fnRescue == null) {
                            throw error;
                        }
                        let hasRetried = false;
                        fnRescue.call(this, error, args, (...retryArgs: any[]) => {
                            checkedAssert(!hasRetried, MSG_SINGLE_RETRY);
                            hasRetried = true;
                            result = _checkedFeature.call(this, ...retryArgs);
                        });
                        if(!hasRetried) {
                            throw error;
                        }
                    }

                    return result;
                };

            if(descriptorWrapper.isMethod) {
                const feature: Function = originalDescriptor.value;
                newDescriptor.value = checkedFeature(feature);
            } else if(descriptorWrapper.isAccessor) {
                if(descriptorWrapper.hasGetter) {
                    const feature: Function = originalDescriptor.get!;
                    newDescriptor.get = checkedFeature(feature);
                }
                if(descriptorWrapper.hasSetter) {
                    const feature: Function = originalDescriptor.set!;
                    newDescriptor.set = checkedFeature(feature);
                }
            } else {
                throw new Error(`Unhandled condition. Unable to restore ${Clazz.name}.prototype.${String(propertyKey)}`);
            }

            Object.defineProperty(proto, propertyKey, newDescriptor);
        });
    }
}