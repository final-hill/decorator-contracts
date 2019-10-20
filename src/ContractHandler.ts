/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';

const contractHandler = Symbol('Contract handler');

/**
 * The ContractHandler manages the registration and evaluation of contracts associated with a class
 */
class ContractHandler {
    protected _assert: typeof Assertion.prototype.assert;

    protected readonly _invariantRegistry: Map<Predicate<any>, string> = new Map();
    // TODO: requiresRegistry
    // TODO: rescueRegistry
    // TODO: ensuresRegistry

    /**
     * Constructs a new instance of the ContractHandler
     * @param _assert - The assertion implementation associated with the current debugMode
     */
    constructor(
        protected assert: typeof Assertion.prototype.assert
    ) {
        this._assert = assert;
    }

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
     * Registers a new invariant contract
     *
     * @param predicate - The invariant predicate
     * @param message - The custome error message
     */
    addInvariant(
        predicate: Predicate<any>,
        message: string
    ) {
        this._assert(!this._invariantRegistry.has(predicate), 'Duplicate invariant');
        this._invariantRegistry.set(predicate, message);
    }

    /**
     * Evaluates all registered invariants
     *
     * @param self - The context class
     */
    assertInvariants(self: object) {
        this._invariantRegistry.forEach((message, predicate) => {
            this._assert(predicate(self), message);
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