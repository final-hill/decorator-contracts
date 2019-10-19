/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import {ContractHandler, contractHandler} from './ContractHandler';
import DescriptorWrapper from './lib/DescriptorWrapper';
import { IS_PROXY, ORIGINAL_DESCRIPTOR } from './lib/OverrideHandler';

type Message = string;
type ClassDecorator = <T extends Constructor<any>>(Constructor: T) => T;

function registerOverrides<T extends Constructor<any>>(Clazz: T) {
    let proto = Clazz.prototype;
    let ds = Object.entries(Object.getOwnPropertyDescriptors(proto));

    [...ds].forEach(([propertyName, propertyDescriptor]) => {
        let dw = new DescriptorWrapper(propertyDescriptor);
        if(dw.isMethod && dw.value[IS_PROXY]) {
            let originalDescriptor = dw.value[ORIGINAL_DESCRIPTOR];
            Object.defineProperty(proto, propertyName, originalDescriptor);
        }
    });
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

            registerOverrides(Base);

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

                        InvariantClass[contractHandler].assertInvariants(this);

                        return new Proxy(this, handler);
                    }
                };
            }
        };
    }
}