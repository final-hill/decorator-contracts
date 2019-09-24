/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import Assertion from './Assertion';
import {ContractHandler, contractHandler} from './ContractHandler';

type Message = string;
type ClassDecorator = <T extends Constructor<any>>(Constructor: T) => T;

/**
 * The `@invariant` decorator describes and enforces the properties of a class
 * via a provided assertion. This assertion is checked after the associated class
 * is constructed, before and after every method execution, and before and after
 * every property usage (get/set).
 */
export default class InvariantDecorator {
    protected _assert: typeof Assertion.prototype.assert;

    constructor(protected debugMode: boolean) {
        this._assert = new Assertion(debugMode).assert;
        this.invariant = this.invariant.bind(this);
    }

    invariant<Self>(predicate: Predicate<Self>, message?: Message): ClassDecorator;
    invariant<Self>(...predicate: Predicate<Self>[]): ClassDecorator;
    invariant<Self>(predicate: Predicate<Self>, message?: any, ...rest: Predicate<Self>[]): ClassDecorator {
        let assert = this._assert,
            debugMode = this.debugMode,
            defaultMessage = 'Invariant violated';

        return function<T extends Constructor<any>>(Constructor: T) {
            if(!debugMode) {
                return Constructor;
            }

            let hasHandler = Object.getOwnPropertySymbols(Constructor.prototype).includes(contractHandler);
            if(hasHandler) {
                let handler: ContractHandler = Constructor.prototype[contractHandler];
                if(typeof message == 'string') {
                    handler.addInvariant(predicate, message);
                } else if(message == undefined) {
                    handler.addInvariant(predicate, 'Invariant violated');
                } else if(typeof message == 'function') {
                    let rs = rest == undefined ? [] : rest;
                    [predicate, message, ...rs].forEach(pred => {
                        handler.addInvariant(pred, defaultMessage);
                    });
                }

                return Constructor;
            } else {
                let handler = new ContractHandler(assert);
                handler.addInvariant(predicate, message);

                class InvariantClass extends Constructor {
                    [contractHandler] = handler;

                    constructor(...args: any[]) {
                        super(...args);
                        this[contractHandler].assertInvariants(this);

                        return new Proxy(this, handler);
                    }
                }

                return InvariantClass;
            }
        };
    }
}