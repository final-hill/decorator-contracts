/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

//import getAncestry from './lib/getAncestry';
import Contract from './Contract';

const contractHandler = {};

/**
 * Associates a contract with a class via the mixin pattern.
 *
 * @param {Contract} _contract The Contract definition
 * @param {T} Base An optional base class
 * @returns {T} The base class for extension
 * @example
 *
 * class Stack<T> extends Contracted(stackContract) {}
 */
function Contracted<T extends Contract<any>,U extends Constructor<any>>(_contract: T, Base?: U): U {
    class Contracted extends (Base ?? Object) {
        constructor(...args: any[]) {
            super(...args);
            //const Class = this.constructor as Constructor<any>,
            //      ancestry = getAncestry(Class).reverse();

            return new Proxy(this, contractHandler);
        }
    }

    return Contracted as U;
}

export default Contracted;