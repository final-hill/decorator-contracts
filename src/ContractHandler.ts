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
import { TRUE_PRED } from './lib/TRUE_PRED';

const CONTRACT_HANDLER = Symbol('Contract handler');

/**
 * The ContractHandler manages the registration and evaluation of contracts associated with a class
 */
class ContractHandler {
    // TODO: demandsRegistry
    // TODO: rescueRegistry
    // TODO: ensuresRegistry

    /**
     * Constructs a new instance of the ContractHandler
     * @param _assert - The assertion implementation associated with the current checkMode
     */
    constructor(
        protected readonly _assert: typeof Assertion.prototype.assert
    ) { }

    /**
     * Wraps a method with invariant assertions
     *
     * @param feature
     * @param target
     */
    protected _decorated(feature: Function, target: object) {
        this.assertInvariants(target);
        let result = feature.apply(target, arguments);
        this.assertInvariants(target);

        return result;
    }

    /**
     * Evaluates all registered invariants
     *
     * @param self - The context class
     */
    assertInvariants(self: object) {
        let ancestry = getAncestry(self.constructor as Constructor<any>);
        ancestry.forEach(Cons => {
            let predTable = DECORATOR_REGISTRY.get(innerClass(Cons))?.invariant ?? TRUE_PRED;
            let predRecord = predTable.call(self, self);
            Object.entries(predRecord).forEach(([name, value]) => {
                this._assert(value, name);
            });
        });
    }

    /**
     * The handler trap for getting property values
     *
     * @param target - The target object
     * @param propertyKey - The name or Symbol  of the property to get
     */
    get(target: object, propertyKey: PropertyKey) {
        this.assertInvariants(target);
        let result = Reflect.get(target, propertyKey);
        this.assertInvariants(target);

        return result;
    }

    /**
     * The handler trap for setting property values
     *
     * @param target - The target object
     * @param prop - The name or Symbol of the property to set
     * @param value - The new value of the property to set.
     */
    set(target: object, propertyKey: PropertyKey, value: (typeof target)[keyof typeof target]) {
        this.assertInvariants(target);
        let result = Reflect.set(target, propertyKey, value);
        this.assertInvariants(target);

        return result;
    }
}

export {ContractHandler, CONTRACT_HANDLER};