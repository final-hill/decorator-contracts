/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { ClassRegistration, CLASS_REGISTRY, Constructor, Feature, takeWhile, assertInvariants } from './lib';
import { assert, checkedMode, Contract } from './';
import { MSG_NO_PROPERTIES, MSG_SINGLE_CONTRACT } from './Messages';

const isContracted = Symbol('isContracted'),
    innerContract = Symbol('innerContract');

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
        assert(!Object.getOwnPropertySymbols(Base).includes(isContracted), MSG_SINGLE_CONTRACT);

        if(contract[checkedMode] === false) {
            return Base;
        }

        class InnerContracted extends Base {
            // prevents multiple @Contracted decorators from being applied
            static readonly [isContracted] = true;
            // The closure variable can not be used directly as a subclass may override the contract
            get [innerContract]() { return contract; }
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

                    // bottom-up to closest Contracted class bind contracts
                    ancRegistrations = takeWhile(ancRegistrations.reverse(), (cr => cr.Class !== Base));
                    [classRegistration, ...ancRegistrations, CLASS_REGISTRY.get(Base)!].forEach(registration => {
                        registration.bindContract(this[innerContract]);
                    });
                }

                assertInvariants(this, classRegistration.contract);

                return this;
            }
        }

        const classRegistration = CLASS_REGISTRY.getOrCreate(InnerContracted);
        classRegistration.contractsChecked = false;

        Object.freeze(Base);

        return InnerContracted;
    };
}

export {isContracted, innerContract};
export default Contracted;