/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { assertInvariants, ClassRegistration, CLASS_REGISTRY, Feature, takeWhile, unChecked } from './lib';
import { assert, checkedMode, Contract, invariant } from './';
import { MSG_NO_PROPERTIES, MSG_SINGLE_CONTRACT } from './Messages';

const isContracted = Symbol('isContracted');

/**
 * Checks the features of the provided object for properties.
 * If any are found an exception is thrown
 * @param {ClassRegistration} registration - The ClassRegistration for the object
 * @param {Record<PropertyKey,unknown>} obj - The object to check
 * @throws {AssertionError} - Throws if a property is found
 * @returns {boolean} - The result of the test
 */
function hasProperties(registration: ClassRegistration, obj: Record<PropertyKey, unknown>): boolean {
    return Object.entries(Object.getOwnPropertyDescriptors(obj))
        .some(([key, desc]) => new Feature(registration,key,desc).isProperty);
}

/**
 * Associates a contract with a class via the mixin pattern.
 *
 * @param {Contract} contract The Contract definition
 * @param {T} Base An optional base class
 * @returns {T} The base class for extension
 * @example
 *
 * @Contracted(stackContract)
 * class Stack<T> { ... }
 */
function Contracted<
    T extends Contract<any> = Contract<any>,
    U extends Constructor<any> = Constructor<any>
>(contract: T = new Contract() as T) {
    return function(Base: U & {[isContracted]?: boolean}): U {
        assert(!Base[isContracted], MSG_SINGLE_CONTRACT);
        Base[isContracted] = true;

        if(contract[checkedMode] === false) {
            return Base;
        }

        // TODO: unit test double decorator is an error
        const Contracted = class extends Base {
            constructor(...args: any[]) {
                super(...args);

                const Class = this.constructor as Constructor<any>,
                      classRegistration = CLASS_REGISTRY.getOrCreate(Class);

                assert(!hasProperties(classRegistration,this), MSG_NO_PROPERTIES);

                if(!classRegistration.contractsChecked) {
                    let ancRegistrations = classRegistration.ancestry().reverse();
                    // top-down check overrides and pre-existing properties
                    [...ancRegistrations, classRegistration].forEach(ancRegistration => {
                        if(!ancRegistration.contractsChecked) {
                            ancRegistration.checkOverrides();
                            ancRegistration.contractsChecked = true;
                        }
                    });

                    // bottom-up to Contracted class bind contracts
                    ancRegistrations = takeWhile(ancRegistrations.reverse(), (cr => cr.Class !== Base));
                    [classRegistration, ...ancRegistrations, CLASS_REGISTRY.get(Base)!].forEach(registration => {
                        registration.bindContract(contract);
                    });
                }

                unChecked(contract, () => assertInvariants(contract[invariant], this));

                // Freezing to prevent public property definitions
                // TODO: test on sub classes
                return Object.freeze(this);
            }
        };

        Object.freeze(Base); // prevent modification of Base[isContracted] and more
        //Object.freeze(Base.prototype);

        return Contracted;
    };
}

export {isContracted};
export default Contracted;