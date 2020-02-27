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
        const result = feature.apply(target, arguments);
        this.assertInvariants(target);

        return result;
    }

    /**
     * Evaluates all registered invariants
     *
     * @param self - The context class
     */
    assertInvariants(self: object) {
        const ancestry = getAncestry(self.constructor as Constructor<any>);
        ancestry.forEach(Cons => {
            const predTable = DECORATOR_REGISTRY.get(innerClass(Cons))?.invariant ?? TRUE_PRED;
            const predRecord = predTable.call(self, self);
            Object.entries(predRecord).forEach(([name, value]) => {
                this._assert(value, name);
            });
        });
    }

    /**
     * The handler trap for getting property values
     *
     * @param target - The target object
     * @param prop - The name or Symbol  of the property to get
     */
    get(target: object, prop: keyof typeof target) {
        // TODO: use descriptorWrapper
        // What if not ownProperty?
        const feature = target[prop];

        switch(typeof feature) {
            case 'function':
                return (...args: any[]) => {
                    this.assertInvariants(target);
                    const result = (feature as Function).call(target, ...args);
                    this.assertInvariants(target);

                    return result;
                };
            // TODO: get could be a getter
            // TODO: if it's a rescue method, no precondition and no invariant
            default:
                return feature;
        }
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

export {ContractHandler, CONTRACT_HANDLER};