/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import {ContractHandler, contractHandler} from './ContractHandler';
import { OVERRIDE_LIST } from './OverrideDecorator';

type Message = string;
type ClassDecorator = <T extends Constructor<any>>(Constructor: T) => T;

/**
 * Returns the method names associated with the provided prototype
 */
function _methodNames(proto: object): Set<PropertyKey> {
    return new Set(
        Object.entries(Object.getOwnPropertyDescriptors(proto))
        .filter(([key, descriptor]) => typeof descriptor.value == 'function' && key != 'constructor')
        .map(([key, _]) => key)
    );
}

/**
 * Returns the method names defined on the provided prototype and its ancestors
 */
function _findAncestorMethodNames(targetProto: object): Set<PropertyKey> {
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

    invariant(predicate: undefined): ClassDecorator;
    invariant<Self>(predicate: Predicate<Self>, message?: Message): ClassDecorator;
    invariant<Self>(...predicate: Predicate<Self>[]): ClassDecorator;
    invariant<Self>(predicate: [Predicate<Self>, Message][]): ClassDecorator;
    invariant<Self>(predicate: undefined | Predicate<Self> | [Predicate<Self>, Message][], message?: any, ...rest: Predicate<Self>[]): ClassDecorator {
        let assert = this._assert,
            debugMode = this.debugMode,
            defaultMessage = 'Invariant violated';

        let invariants: [Predicate<Self>, Message][] =
            typeof predicate == 'undefined' ? [] :
            Array.isArray(predicate) ? predicate :
            typeof message == 'string' ? [[predicate, message]] :
            message == undefined ? [[predicate, defaultMessage]] :
            [predicate, message, ...rest].map(pred => [pred, defaultMessage]);

        return function<T extends Constructor<any>>(Base: T) {
            if(!debugMode) {
                return Base;
            }

            let hasHandler = Object.getOwnPropertySymbols(Base).includes(contractHandler);
            let handler: ContractHandler = hasHandler ?
                (Base as any)[contractHandler] :
                new ContractHandler(assert);
            invariants.forEach(([pred, message]) => {
                handler.addInvariant(pred, message);
            });

            if(hasHandler) {
                return Base;
            } else {
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
        };
    }
}