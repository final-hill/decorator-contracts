/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import {ContractHandler, CONTRACT_HANDLER} from './ContractHandler';
import OverrideDecorator from './OverrideDecorator';
import isClass from './lib/isClass';
import type {FnPredTable} from './typings/FnPredTable';
import type {Constructor} from './typings/Constructor';
import MemberDecorator from './MemberDecorator';
import getAncestry from './lib/getAncestry';
// FIXME: The symbols don't belong here
import { DecoratedConstructor, INNER_CLASS, IS_PROXY } from './typings/DecoratedConstructor';
import { DECORATOR_REGISTRY } from './DECORATOR_REGISTRY';
import innerClass from './lib/innerClass';
import { TRUE_PRED } from './lib/TRUE_PRED';

export type ClassDecorator = <T extends Constructor<any>>(Constructor: T) => T;

export const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
export const MSG_DUPLICATE_INVARIANT = `Only a single @invariant can be assigned per class`;

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
    invariant<U extends (Constructor<any> | any)>(fn: Function | Constructor<any>) {
        let predTable = isClass(fn) ? TRUE_PRED : fn as FnPredTable<U>,
            Clazz = isClass(fn) ? innerClass(fn as Constructor<any>) : undefined,
            assert = this._assert,
            checkMode = this.checkMode,
            hasInvariant = Clazz == undefined ? false : DECORATOR_REGISTRY.has(Clazz);

        assert(!hasInvariant, MSG_DUPLICATE_INVARIANT);
        assert(typeof fn == 'function', MSG_INVALID_DECORATOR);

        function decorator(Clazz: Constructor<any>) {
            assert(isClass(Clazz), MSG_INVALID_DECORATOR);

            if(!checkMode) {
                return Clazz;
            }

            let hasInvariant = DECORATOR_REGISTRY.has(Clazz);
            assert(!hasInvariant, MSG_DUPLICATE_INVARIANT);

            let handler: ContractHandler = new ContractHandler(assert);

            // TODO: move to registry
            (Clazz as DecoratedConstructor)[CONTRACT_HANDLER] = handler;

            DECORATOR_REGISTRY.set(Clazz, { isRestored: false, invariant: predTable });

            // TODO: lift
            let ClazzProxy = new Proxy((Clazz as DecoratedConstructor), {
                construct(Target: Constructor<any>, args: any[], NewTarget: Constructor<any>) {
                    let ancestry = getAncestry(NewTarget).reverse();
                    ancestry.forEach(Cons => {
                        let InnerClass = innerClass(Cons);
                        if(!DECORATOR_REGISTRY.has(InnerClass)) {
                            DECORATOR_REGISTRY.set(InnerClass, {isRestored: false, invariant: TRUE_PRED});
                        }
                        let registration = DECORATOR_REGISTRY.get(InnerClass)!;
                        if(!registration.isRestored) {
                            OverrideDecorator.checkOverrides(InnerClass);
                            MemberDecorator.restoreFeatures(InnerClass);
                            registration.isRestored = true;
                        }
                    });

                    // https://stackoverflow.com/a/43104489/153209
                    let obj = Reflect.construct(Target, args, NewTarget);
                    handler.assertInvariants(obj);

                    return new Proxy(obj, handler);
                },
                get(target, name) {
                    switch(name) {
                        case IS_PROXY: return true;
                        case INNER_CLASS: return target;
                        default: break;
                    }

                    const property = Reflect.get(target, name);

                    // https://stackoverflow.com/a/42461846/153209
                    return (typeof property === 'function')
                        ? property.bind(target)
                        : property;
                },
                ownKeys(target) {
                    return Reflect.ownKeys(target).concat([IS_PROXY, INNER_CLASS]);
                }
            });

            return ClazzProxy;
        }

        return Clazz != undefined ? decorator(Clazz) : decorator;
    }
}