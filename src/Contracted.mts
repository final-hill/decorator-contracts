/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { ClassRegistration, CLASS_REGISTRY, ClassType, Feature, takeWhile, assertInvariants } from './lib/index.mjs';
import { assert, checkedMode, Contract, extend } from './index.mjs';
import { Messages } from './Messages.mjs';

const isContracted = Symbol('isContracted'),
    innerContract = Symbol('innerContract');

/**
 * Checks the features of the provided object for properties.
 * If any are found an exception is thrown
 * @param {ClassRegistration} registration - The ClassRegistration for the object
 * @param {U} obj - The object to check
 * @throws {AssertionError} - Throws if a property is found
 * @returns {boolean} - The result of the test
 */
function hasProperties<U>(registration: ClassRegistration, obj: U): boolean {
    return Object.entries(Object.getOwnPropertyDescriptors(obj))
        .some(([key, desc]) => new Feature(registration, key, desc).isProperty);
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
    U extends ClassType<any> = ClassType<any>
>(contract: T = new Contract() as T): ClassDecorator {
    return function (Base: U & { [innerContract]?: Contract<any> }) {
        assert(!Object.getOwnPropertySymbols(Base).includes(isContracted), Messages.MsgSingleContract);

        if (contract[checkedMode] === false)
            return Base;

        const baseContract = Base[innerContract];
        assert(
            !baseContract ||
            baseContract && contract[extend] instanceof baseContract.constructor,
            Messages.MsgBadSubcontract
        );

        abstract class InnerContracted extends Base {
            // prevents multiple @Contracted decorators from being applied
            static readonly [isContracted] = true;

            constructor(...args: any[]) {
                super(...args);

                const Class = this.constructor as ClassType<any>,
                    classRegistration = CLASS_REGISTRY.getOrCreate(Class);

                assert(!hasProperties(classRegistration, this), Messages.MsgNoProperties);

                if (!classRegistration.contractsChecked) {
                    let ancRegistrations = classRegistration.ancestry().reverse();
                    // top-down check overrides and pre-existing properties
                    [...ancRegistrations, classRegistration].forEach(ancRegistration => {
                        if (!ancRegistration.contractsChecked) {
                            ancRegistration.checkOverrides();
                            ancRegistration.contractsChecked = true;
                        }
                    });

                    // bottom-up to closest Contracted class bind contracts
                    ancRegistrations = takeWhile(ancRegistrations.reverse(), (cr => cr.Class !== Base));
                    [classRegistration, ...ancRegistrations, CLASS_REGISTRY.get(Base)!].forEach(registration => {
                        registration.bindContract(InnerContracted[innerContract]);
                    });
                }

                assertInvariants(this, InnerContracted[innerContract]);

                return this;
            }

            // FIXME: dirty hack. Possibly resolved by moving to contracts as classes
            // The static getter is used by the construction invariant check
            // The instance getter is used by the feature declarations
            static get [innerContract]() { return contract; }
            get [innerContract]() { return contract; }
        }

        const classRegistration = CLASS_REGISTRY.getOrCreate(InnerContracted);
        classRegistration.contractsChecked = false;

        Object.freeze(Base);

        return InnerContracted;
    } as ClassDecorator;
}

export { isContracted, innerContract };
export default Contracted;