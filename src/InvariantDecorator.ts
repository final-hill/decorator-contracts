/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import {ContractHandler, contractHandler} from './ContractHandler';
import OverrideDecorator from './OverrideDecorator';
import isConstructor from './lib/isConstructor';
import FnPredTable from './typings/FnPredTable';
import Constructor from './typings/Constructor';

type ClassDecorator = <T extends Constructor<any>>(Constructor: T) => T;

export const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
export const MSG_DUPLICATE_INVARIANT = `Only a single @invariant can be assigned per class`;
export const HAS_INVARIANT = Symbol('Has Invariant');
const TRUE_PRED = () => ({ pass: true });

/**
 * The `@invariant` decorator describes and enforces the properties of a class
 * via assertions. These assertions are checked after the associated class
 * is constructed, before and after every method execution, and before and after
 * every accessor usage (get/set).
 */
export default class InvariantDecorator {
    protected _assert: typeof Assertion.prototype.assert;

    constructor(protected checkMode: boolean) {
        this._assert = new Assertion(checkMode).assert;
        this.invariant = this.invariant.bind(this);
    }

    invariant<T extends Constructor<any>>(Base: T): T;
    invariant<Self>(fnPredTable: FnPredTable<Self>): ClassDecorator;
    invariant<U extends (Constructor<any> | any)>(fn: Function) {
        let predTable = isConstructor(fn) ? TRUE_PRED : fn as FnPredTable<U>,
            Clazz = isConstructor(fn) ? fn : undefined,
            assert = this._assert,
            checkMode = this.checkMode;

        assert(typeof fn == 'function', MSG_INVALID_DECORATOR);

        function decorator(Base: any) {
            if(!checkMode) {
                return Base;
            }

            let hasHandler = Object.getOwnPropertySymbols(Base).includes(contractHandler);
            assert(!hasHandler, MSG_DUPLICATE_INVARIANT);

            let handler: ContractHandler = new ContractHandler(assert, predTable);

            return class InvariantClass extends Base {
                static [contractHandler]: ContractHandler = handler;
                static [HAS_INVARIANT] = true;

                constructor(...args: any[]) {
                    super(...args);

                    OverrideDecorator.checkOverrides(this.constructor);
                    InvariantClass[contractHandler].assertInvariants(this);

                    return new Proxy(this, handler);
                }
            };
        }

        return isConstructor(fn) ? decorator(Clazz!) : decorator;
    }
}