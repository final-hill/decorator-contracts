/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import OverrideDecorator from './OverrideDecorator';
import isClass from './lib/isClass';
import MemberDecorator from './MemberDecorator';
import getAncestry from './lib/getAncestry';
// FIXME: The symbols don't belong here
import { DecoratedConstructor, INNER_CLASS, IS_PROXY } from './typings/DecoratedConstructor';
import { DECORATOR_REGISTRY } from './DECORATOR_REGISTRY';
import innerClass from './lib/innerClass';
import type {Constructor} from './typings/Constructor';
import { PredicateType } from './typings/PredicateType';

export type ClassDecorator = <T extends Constructor<any>>(Constructor: T) => T;

export const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';

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
    invariant<Self>(predicate: PredicateType): ClassDecorator;
    invariant(fn: Function | Constructor<any>) {
        let isClazz = isClass(fn),
            predicate = isClazz ? undefined : fn as PredicateType,
            Clazz = isClazz ? innerClass(fn as Constructor<any>) : undefined,
            assert = this._assert,
            checkMode = this.checkMode;

        assert(typeof fn == 'function', MSG_INVALID_DECORATOR);

        function decorator(Clazz: Constructor<any>) {
            assert(isClass(Clazz), MSG_INVALID_DECORATOR);

            if(!checkMode) {
                return Clazz;
            }

            let registration = DECORATOR_REGISTRY.getOrCreate(innerClass(Clazz));
            if(predicate != undefined) {
                registration.invariants.push(predicate);
            }

            // TODO: lift
            let ClazzProxy = new Proxy((Clazz as DecoratedConstructor), {
                construct(Target: Constructor<any>, args: any[], NewTarget: Constructor<any>) {
                    let ancestry = getAncestry(NewTarget).reverse();
                    ancestry.forEach(Cons => {
                        let InnerClass = innerClass(Cons);
                        let registration = DECORATOR_REGISTRY.getOrCreate(InnerClass);

                        if(!registration.isRestored) {
                            OverrideDecorator.checkOverrides(InnerClass);
                            MemberDecorator.restoreFeatures(InnerClass);
                            registration.isRestored = true;
                        }
                    });

                    // https://stackoverflow.com/a/43104489/153209
                    let obj = Reflect.construct(Target, args, NewTarget);
                    registration.contractHandler.assertInvariants(obj);

                    return new Proxy(obj, registration.contractHandler);
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
                    let ownSet = new Set(Reflect.ownKeys(target));
                    ownSet.add(IS_PROXY).add(INNER_CLASS);

                    return [...ownSet];
                }
            });

            return ClazzProxy;
        }

        return Clazz != undefined ? decorator(Clazz) : decorator;
    }
}