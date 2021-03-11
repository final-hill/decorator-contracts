/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import takeWhile from './lib/takeWhile';
import CLASS_REGISTRY from './lib/CLASS_REGISTRY';
import { assert, Contract, invariant } from './';
import unChecked from './lib/unChecked';
import { assertInvariants } from './lib/ClassRegistration';

const isContracted = Symbol('isContracted');

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
    return function(Base: U): U {
        const classRegistration = CLASS_REGISTRY.getOrCreate(Base);

        assert(!classRegistration.isContracted, 'Only a single @Contracted decorator is allowed');

        // TODO: unit test double decorator is an error
        const Contracted = class extends Base {
            static get [isContracted](){ return true; }

            constructor(...args: any[]) {
                super(...args);
                const Class = this.constructor as Constructor<any>,
                  classRegistration = CLASS_REGISTRY.getOrCreate(Class);

                if(!classRegistration.contractsChecked) {
                    let ancRegistrations = classRegistration.ancestry().reverse();
                    // top-down check overrides
                    [...ancRegistrations, classRegistration].forEach(ancRegistration => {
                        if(!ancRegistration.contractsChecked) {
                            ancRegistration.checkOverrides();
                            ancRegistration.contractsChecked = true;
                        }
                    });

                    // bottom-up to Contracted class (exclusive) bind contracts
                    ancRegistrations = takeWhile(ancRegistrations.reverse(), (cr => !Reflect.ownKeys(cr.Class).includes(isContracted)));
                    [classRegistration, ...ancRegistrations].forEach(registration => {
                        registration.bindContract(contract);
                    });
                }

                this[invariant]();

                // Freezing to prevent public property definitions
                return Object.freeze(this);
            }

            [invariant]() { unChecked(contract, () => assertInvariants(contract[invariant], this)); }
        };

        return Contracted;
    };
}

export {isContracted};
export default Contracted;