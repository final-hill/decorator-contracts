/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import {ContractHandler, contractHandler} from './ContractHandler';
import { OVERRIDE_LIST } from './OverrideDecorator';
import isConstructor from './lib/isContructor';
import FnPredTable from './typings/FnPredTable';

type ClassDecorator = <T extends Constructor<any>>(Constructor: T) => T;

const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
export const MSG_DUPLICATE_INVARIANT = `Only a single @invariant can be assigned per class`;
const TRUE_PRED = () => ({ pass: true });

/**
 * Returns the method names associated with the provided prototype
 */
function _methodNames(proto: object): Set<PropertyKey> {
    return proto == null ? new Set() : new Set(
        Object.entries(Object.getOwnPropertyDescriptors(proto))
        .filter(([key, descriptor]) => typeof descriptor.value == 'function' && key != 'constructor')
        .map(([key, _]) => key)
    );
}

/**
 * Returns the method names defined on the provided prototype and its ancestors
 */
function _findAncestorMethodNames(targetProto: object): Set<PropertyKey> {
    if(targetProto == null) {
        return new Set();
    }
    let proto = Object.getPrototypeOf(targetProto);

    return proto == null ? new Set() :
        new Set([..._methodNames(proto), ..._findAncestorMethodNames(proto)]);

}

function _checkOverrides(
    assert: typeof Assertion.prototype.assert,
    Clazz: Function & {[OVERRIDE_LIST]?: Set<PropertyKey>},
    proto: object
) {
    let methodNames = _methodNames(proto),
        ancestorMethodNames: Set<PropertyKey> = _findAncestorMethodNames(proto),
        overrides: Set<PropertyKey> = Object.getOwnPropertySymbols(Clazz).includes(OVERRIDE_LIST) ?
            Clazz[OVERRIDE_LIST]! : new Set();

    methodNames.forEach(methodName =>
        assert(
            overrides.has(methodName) || !ancestorMethodNames.has(methodName),
            `@override decorator missing on ${Clazz.name}.${String(methodName)}`
        )
    );
}

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
        this._assert(typeof fn == 'function', MSG_INVALID_DECORATOR);

        let predTable = isConstructor(fn) ? TRUE_PRED : fn as FnPredTable<U>,
            Clazz = isConstructor(fn) ? fn : undefined,
            assert = this._assert,
            checkMode = this.checkMode;

        function decorator(Base: any) {
            if(!checkMode) {
                return Base;
            }

            let hasHandler = Object.getOwnPropertySymbols(Base).includes(contractHandler);
            assert(!hasHandler, MSG_DUPLICATE_INVARIANT);

            let handler: ContractHandler = new ContractHandler(assert, predTable);

            return class InvariantClass extends Base {
                static [contractHandler]: ContractHandler = handler;

                constructor(...args: any[]) {
                    super(...args);

                    let Clazz = this.constructor;
                    _checkOverrides(assert, Clazz, Clazz.prototype);
                    InvariantClass[contractHandler].assertInvariants(this);

                    return new Proxy(this, handler);
                }
            };
        }

        return isConstructor(fn) ? decorator(Clazz!) : decorator;
    }
}