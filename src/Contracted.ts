/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import takeWhile from './lib/takeWhile';
import {Contract} from './Contract';
import CLASS_REGISTRY from './lib/CLASS_REGISTRY';

const isContracted = Symbol('isContracted');

/**
 * Associates a contract with a class via the mixin pattern.
 *
 * @param {Contract} contract The Contract definition
 * @param {T} Base An optional base class
 * @returns {T} The base class for extension
 * @example
 *
 * class Stack<T> extends Contracted(stackContract) { ... }
 */
function Contracted<
    T extends Contract<any> = Contract<any>, U extends Constructor<any> = Constructor<any>
>(
    contract: T = new Contract() as T, Base: U = Object as any
): U & {[isContracted]: boolean} {
    class Contracted extends Base {
        static [isContracted] = true;

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

            // TODO: Should a proxy be used for preventing 3rd party methods
            // being called/applied to this instance? They could
            // modify internal state without an invariant check...
            return Object.freeze(this); // Freezing to prevent public property definitions
        }
    }

    return Contracted as U & {[isContracted]: boolean};
}

export {isContracted};
export default Contracted;