/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
*/


import Assertion from './Assertion';
import { DECORATOR_REGISTRY } from './DECORATOR_REGISTRY';
import type {Constructor} from './typings/Constructor';
import getAncestry from './lib/getAncestry';
import innerClass from './lib/innerClass';

/**
 * The ContractHandler manages the registration and evaluation of contracts associated with a class
 */
class ContractHandler {
    // TODO: demandsRegistry
    // TODO: rescueRegistry
    // TODO: ensuresRegistry

    /**
     * Constructs a new instance of the ContractHandler
     * @param {Assertion.prototype.assert} _assert - The assertion implementation associated with the current checkMode
     */
    constructor(
        protected readonly _assert: typeof Assertion.prototype.assert
    ) { }

    /**
     * Evaluates all registered invariants
     *
     * @param {object} self - The context class
     */
    assertInvariants(self: object): void {
        const ancestry = getAncestry(self.constructor as Constructor<any>);
        ancestry.forEach(Cons => {
            const invariants = DECORATOR_REGISTRY.get(innerClass(Cons))?.invariants ?? [];
            invariants.forEach(invariant => {
                const name = invariant.name;
                this._assert(invariant.apply(self), `Invariant violated. ${name}: ${invariant.toString()}`);
            });
        });
    }

    /**
     * The handler trap for getting property values
     *
     * @param {object} target - The target object
     * @param {PropertyKey} propertyKey - The name or Symbol  of the property to get
     * @returns {any} - The result of executing 'get' on the target
     */
    get(target: object, propertyKey: PropertyKey): any {
        this.assertInvariants(target);
        const result = Reflect.get(target, propertyKey);
        this.assertInvariants(target);

        return result;
    }

    /**
     * The handler trap for setting property values
     *
     * @param {object} target - The target object
     * @param {PropertyKey} propertyKey - The name or Symbol of the property to set
     * @param {any} value - The new value of the property to set.
     * @returns {boolean} - The result of executing 'set' on the target
     */
    set(target: object, propertyKey: PropertyKey, value: any): boolean {
        this.assertInvariants(target);
        const result = Reflect.set(target, propertyKey, value);
        this.assertInvariants(target);

        return result;
    }
}

export default ContractHandler;