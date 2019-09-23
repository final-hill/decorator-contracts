/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import Assertion from './Assertion';

const contractHandler = Symbol('Contract handler');

/**
 *
 */
class ContractHandler {
    protected _assert: typeof Assertion.prototype.assert;

    protected readonly _invariantRegistry: Map<Predicate<any>, string> = new Map();
    // TODO: requiresRegistry
    // TODO: rescueRegistry
    // TODO: ensuresRegistry

    /**
     *
     * @param _assert
     */
    constructor(
        protected assert: typeof Assertion.prototype.assert
    ) {
        this._assert = assert;
    }

    /**
     *
     * @param feature
     * @param target
     */
    protected _decorated(feature: any, target: any) {
        this.assertInvariants(target);
        let result = feature.apply(target, arguments);
        this.assertInvariants(target);

        return result;
    }

    /**
     *
     * @param predicate
     * @param message
     */
    addInvariant(
        predicate: Predicate<any>,
        message: string
    ) {
        this._assert(!this._invariantRegistry.has(predicate), 'Duplicate invariant');
        this._invariantRegistry.set(predicate, message);
    }

    /**
     *
     * @param self
     * @param args
     */
    assertInvariants(self: any) {
        this._invariantRegistry.forEach((message, predicate) => {
            this._assert(predicate(self), message);
        });
    }

    /**
     *
     * @param target
     * @param prop
     */
    get(target: any, prop: any) {
        let feature = target[prop];

        // TODO: get could be a getter
        return typeof feature == 'function' ?
            this._decorated.bind(this, feature, target) :
            feature;
    }

    /**
     *
     * @param target
     * @param prop
     * @param value
     */
    set(target: any, prop: any, value: any) {
        this.assertInvariants(target);
        target[prop] = value;
        this.assertInvariants(target);

        return true;
    }
}

export {ContractHandler, contractHandler};