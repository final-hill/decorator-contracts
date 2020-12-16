/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import Assertion from '../Assertion';
import CLASS_REGISTRY from './CLASS_REGISTRY';
import Feature from './Feature';

const assert: Assertion['assert'] = new Assertion(true).assert;

class ClassRegistration {
    #features: Feature[];

    /**
     * Has the current registration been validated?
     * 1. override declarations valid?
     */
    validated = false;

    constructor(readonly Class: Constructor<any>) {
        this.#features = Object.entries(Object.getOwnPropertyDescriptors(this.Class.prototype))
            .map(([key, descriptor]) => new Feature(this, key, descriptor))
            .filter(feature => feature.key != 'constructor');
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
        return this.ancestry().flatMap(ancestor => ancestor.features);
    }

    /**
     * Checks the features of the registered class for missing override decorators
     * @throws {AssertionError} - Throws if the verification fails
     */
    checkOverrides(): void {
        const ancestryFeatureNames = this.ancestryFeatures().map(feature => feature.key);

        this.features.forEach(feature => {
            const str = `${this.Class.name}.prototype.${String(feature.key)}`;
            assert(feature.hasOverrides && ancestryFeatureNames.includes(feature.key), `Unnecessary @override declaration on ${str}`);
            assert(!feature.hasOverrides && !ancestryFeatureNames.includes(feature.key), `@override decorator missing on ${str}`);
        });
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