/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { assert, checkedMode, Contract, Demands, Ensures, Invariant, invariant } from '../';
import { NormalizedFeatureContract } from '../Contract';
import CLASS_REGISTRY from './CLASS_REGISTRY';
import Feature from './Feature';
import unChecked from './unChecked';

const assertDemands = (demands: Demands<any,any>[], demandsError: string, self: Record<PropertyKey, unknown>, ...args: any[]) =>
        assert(demands.every(demand => demand.call(self, self, ...args)), demandsError),
    assertEnsures = (ensures: Ensures<any, any>[], ensuresError: string, self: Record<PropertyKey, unknown>, old: Record<PropertyKey, unknown>, ...args: any[]) =>
        assert(ensures.every(ensure => ensure.call(self, self, old, ...args)), ensuresError),
    assertInvariants = (invariants: Invariant<any>[], self: Record<PropertyKey, unknown>) =>
        invariants.forEach(i => assert(i.call(self,self),`Invariant violated. ${i.toString()}`));

/**
 * Manages the evaluation of contract assertions for a feature
 *
 * @param {string} className - The name of the owning class
 * @param {string} featureName - The name of the feature
 * @param {function(...args: any[]): any} fnOrig - The original unchecked feature
 * @param {Contract<any>} contract - The code contract
 *
 * @returns {function(...args: any[]): any} - The original function augments with assertion checks
 */
function checkedFeature(
    className: string,
    featureName: string,
    fnOrig: (...args: any[]) => any,
    contract: Contract<any>
) {
    const demandsError = `demands failed on ${className}.prototype.${featureName}`,
        ensuresError = `ensures failed on ${className}.prototype.${featureName}`,
        {demands, ensures, rescue}: NormalizedFeatureContract<any, any> = Reflect.get(contract.assertions,featureName) ?? {demands: [], ensures: []};

    return function checkedFeature(this: any, ...args: any[]) {
        if(!contract[checkedMode]) {
            return fnOrig.apply(this,args);
        }

        let old = Object.create(null);
        unChecked(contract, () => {
            old = Object.entries(this).reduce((acc,[key,value]) => {
                if(typeof value != 'function') {
                    Object.defineProperty(acc,key,{value});
                }

                return acc;
            }, Object.create(null));
            assertInvariants(contract[invariant],this);
            assertDemands(demands, demandsError, this, args);
        });

        let result;
        try {
            result = fnOrig.apply(this,args);
            unChecked(contract, () => assertEnsures(ensures, ensuresError, this, old, args));
        } catch(error) {
            if(rescue == null) { throw error; }
            let hasRetried = false;
            unChecked(contract, () => {
                rescue.call(this, this, error, [], () => {
                    hasRetried = true;
                    contract[checkedMode] = true;
                    result = checkedFeature.call(this, ...args);
                });
            });
            if(!hasRetried) { throw error; }
        }
        unChecked(contract, () => assertInvariants(contract[invariant],this));

        return result;
    };
}

class ClassRegistration {
    #features: Feature[];

    contractsChecked = false;
    isContracted = false;

    constructor(readonly Class: Constructor<any>) {
        this.#features = Object.entries(Object.getOwnPropertyDescriptors(this.Class.prototype))
            .filter(([key]) => key != 'constructor')
            .map(([key, descriptor]) => new Feature(this, key, descriptor));
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
        if(!contract[checkedMode]) {
            return;
        }
        const proto = this.Class.prototype,
            className = this.Class.name;
        assert(!Object.isFrozen(proto), 'Unable to bind contract feature. Prototype is frozen');

        this.features.forEach(feature => {
            const name = String(feature.name),
                {hasGetter, hasSetter, isMethod} = feature;

            Object.defineProperty(proto, name, {
                ...(hasGetter ? {get: checkedFeature(className, name, feature.getter!, contract) } : {}),
                ...(hasSetter ? {set: checkedFeature(className, name, feature.setter!, contract) } : {}),
                ...(isMethod ? {value: checkedFeature(className, name, feature.value, contract) } : {})
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

export {assertInvariants};
export default ClassRegistration;