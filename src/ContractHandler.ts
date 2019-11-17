/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import FnPredTable from './typings/FnPredTable';

const contractHandler = Symbol('Contract handler');

/**
 * The ContractHandler manages the registration and evaluation of contracts associated with a class
 */
class ContractHandler {
    // TODO: requiresRegistry
    // TODO: rescueRegistry
    // TODO: ensuresRegistry

    /**
     * Constructs a new instance of the ContractHandler
     * @param _assert - The assertion implementation associated with the current debugMode
     */
    constructor(
        protected readonly _assert: typeof Assertion.prototype.assert,
        protected readonly _fnInvariantRecord: FnPredTable<any>
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
        let predRecord = this._fnInvariantRecord.call(self, self);
        Object.entries(predRecord).forEach(([name, value]) => {
            this._assert(value, name);
        });
    }

    /**
     * The handler trap for getting property values
     *
     * @param target - The target object
     * @param prop - The name or Symbol  of the property to get
     */
    get(target: object, prop: keyof typeof target) {
        let feature = target[prop];

        // TODO: get could be a getter
        // TODO: if it's a rescue method, no precondition and no invariant
        return typeof feature == 'function' ?
            this._decorated.bind(this, feature, target) :
            feature;
    }

    /**
     * The handler trap for setting property values
     *
     * @param target - The target object
     * @param prop - The name or Symbol  of the property to set
     * @param value - The new value of the property to set.
     */
    set(target: object, prop: keyof typeof target, value: (typeof target)[keyof typeof target]) {
        this.assertInvariants(target);
        target[prop] = value;
        this.assertInvariants(target);

        return true;
    }
}

export {ContractHandler, contractHandler};