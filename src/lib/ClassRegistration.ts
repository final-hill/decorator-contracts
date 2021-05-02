/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { MSG_SINGLE_RETRY } from '../Messages';
import { assert, checkedMode, Contract, innerContract } from '../';
import { assertInvariants, assertDemands, CLASS_REGISTRY, Constructor, Feature, unChecked } from './';
import assertEnsures from './assertEnsures';

/**
 * Manages the evaluation of contract assertions for a feature
 *
 * @param {string} featureName - The name of the feature
 * @param {function(...args: any[]): any} fnOrig - The original unchecked feature
 * @param {ClassRegistration} registration - The class registration
 *
 * @returns {function(...args: any[]): any} - The original function augments with assertion checks
 */
function checkedFeature(
    featureName: PropertyKey,
    fnOrig: (...args: any[]) => any,
    registration: ClassRegistration
) {
    return function innerCheckedFeature(this: any, ...args: any[]) {
        const {contract, Class} = registration,
            className = Class.name;
        if(!contract[checkedMode]) {
            return fnOrig.apply(this,args);
        }

        assertInvariants(this, contract);
        assertDemands(this, contract, className, featureName, args);

        let result;
        try {
            const old = Object.create(null);
            unChecked(contract, () => {
                registration.features.forEach(({name, hasGetter}) => {
                    if(hasGetter) {
                        Object.defineProperty(old, name, {value: this[name]});
                    }
                });
            });
            result = fnOrig.apply(this,args);
            assertEnsures(this, contract, className, featureName, old, args);
        } catch(error) {
            const rescue = Reflect.get(contract.assertions,featureName)?.rescue;
            if(rescue == null) {
                assertInvariants(this, contract);
                throw error;
            }
            let hasRetried = false;
            unChecked(contract, () => {
                rescue.call(this, this, error, [], (...args: any[]) => {
                    assert(!hasRetried, MSG_SINGLE_RETRY);
                    hasRetried = true;
                    contract[checkedMode] = true;
                    result = innerCheckedFeature.call(this, ...args);
                });
            });
            if(!hasRetried) {
                assertInvariants(this, contract);
                throw error;
            }
        }

        assertInvariants(this, contract);

        return result;
    };
}

class ClassRegistration {
    #features: Feature[];
    contract!: Contract<any>; // Assigned by the Contracted class via this.bindContract
    contractsChecked = false;

    constructor(readonly Class: Constructor<any>) {
        const proto = this.Class.prototype;
        this.#features =
            Reflect.ownKeys(proto)
            .filter(key => key != 'constructor' && key !== innerContract)
            .map(key => new Feature(this, key, Object.getOwnPropertyDescriptor(proto,key)!));
    }

    /**
     * Returns a reference to the parent class
     */
    get ParentClass(): Constructor<any> | null {
        return Object.getPrototypeOf(this.Class.prototype)?.constructor;
    }

    /**
     * Returns the classRegistration of the parent class
     */
    get parentRegistration(): ClassRegistration | null {
        return this.ParentClass == null ? null : CLASS_REGISTRY.getOrCreate(this.ParentClass);
    }

    /**
     * Returns the registered class's ancestor class registrations.
     * Does not include the current class.
     *
     * @returns {ClassRegistration[]} - The ancestor class registrations
     */
    ancestry(): ClassRegistration[] {
        if(this.ParentClass == null) {
            return [];
        } else {
            const parentRegistry = CLASS_REGISTRY.getOrCreate(this.ParentClass);

            return [parentRegistry,...parentRegistry.ancestry()];
        }
    }

    /**
     * Returns the features associated with the registered class's ancestors.
     * Does not include the current class.
     *
     * @returns {Feature[]} - The feature names
     */
    ancestryFeatures(): Feature[] {
        return this.ancestry().flatMap(({features}) => features);
    }

    bindContract<T extends Contract<any>>(contract: T) {
        this.contract = contract;
        if(!contract[checkedMode]) {
            return;
        }
        const proto = this.Class.prototype;
        this.features.forEach(feature => {
            const {name,hasGetter, hasSetter, isMethod} = feature;

            Object.defineProperty(proto, name, {
                enumerable: true,
                ...(hasGetter ? {get: checkedFeature(name, feature.getter!, this) } : {}),
                ...(hasSetter ? {set: checkedFeature(name, feature.setter!, this) } : {}),
                ...(isMethod ? {value: checkedFeature(name, feature.value, this) } : {})
            });

            feature.descriptor = Object.getOwnPropertyDescriptor(proto, name)!;
        });
    }

    /**
     * Checks the features of the registered class for missing override decorators
     * @throws {AssertionError} - Throws if the verification fails
     */
    checkOverrides(): void {
        const ancestryFeatureNames = new Set(this.ancestryFeatures().map(({name}) => name));
        this.features.forEach(({name, hasOverrides}) => {
            const str = `${this.Class.name}.prototype.${String(name)}`;
            assert(!hasOverrides || ancestryFeatureNames.has(name),`Unnecessary @override declaration on ${str}`);
            assert(hasOverrides || !ancestryFeatureNames.has(name), `@override decorator missing on ${str}`);
        });
    }

    /**
     * Searches the current class and its ancestors for the nearest feature
     * matching the provided propertyKey.
     *
     * @param {PropertyKey} propertyKey - The key being searched
     * @returns {Feature | undefined} - The feature if it exists else otherwise
     */
    findFeature(propertyKey: PropertyKey): Feature | undefined {
        return this.features.find(({name}) => name === propertyKey) ??
            this.parentRegistration?.findFeature(propertyKey);
    }

    /**
     * Returns the features associated with the registered class.
     *
     * @returns {Set<Feature>} The set of features
     */
    get features(): Feature[] {
        return [...this.#features];
    }
}

export default ClassRegistration;