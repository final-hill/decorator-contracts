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
import { INNER_CLASS, IS_PROXY } from './typings/DecoratedConstructor';
import { CLASS_REGISTRY } from './lib/CLASS_REGISTRY';
import type { Constructor } from './typings/Constructor';
import { PredicateType } from './typings/PredicateType';

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
    /**
     * The `@invariant` decorator describes and enforces the properties of a class
     * via assertions. These assertions are checked after the associated class
     * is constructed, before and after every method execution, and before and after
     * every accessor usage (get/set).
     *
     * @param {PredicateType | Constructor<any>} fn - An optional assertion to apply to the class
     * @returns {ClassDecorator | Constructor<any>} - The decorated class, or the decorator if a predicate was provided
     * @throws {AssertionError} - Throws an Assertion error if not applied to a class.
     */
    invariant(fn: PredicateType | Constructor<any>): ClassDecorator | Constructor<any> {
        const isClazz = isClass(fn),
            predicate = isClazz ? undefined : fn as PredicateType,
            Clazz = isClazz ? fn as Constructor<any> : undefined,
            assert: Assertion['assert'] = this._assert,
            checkMode = this.checkMode;

        assert(typeof fn == 'function', MSG_INVALID_DECORATOR);

        /**
         * The class decorator
         *
         * @param {Constructor<any>} Clazz - The class being decorated
         * @returns {Constructor<any>} - The decorated class
         */
        function decorator(Clazz: Constructor<any>): Constructor<any> {
            assert(isClass(Clazz), MSG_INVALID_DECORATOR);

            if(!checkMode) {
                return Clazz;
            }

            const registration = CLASS_REGISTRY.getOrCreate(Clazz);
            if(predicate != undefined) {
                registration.invariants.push(predicate);
            }

            // TODO: lift
            const ClazzProxy = new Proxy(Clazz, {
                construct(Target: Constructor<any>, args: any[], NewTarget: Constructor<any>): object {
                    const ancestry = getAncestry(NewTarget).reverse();
                    ancestry.forEach(Cons => {
                        const registration = CLASS_REGISTRY.getOrCreate(Cons);

                        if(!registration.isRestored) {
                            OverrideDecorator.checkOverrides(Cons);
                            MemberDecorator.restoreFeatures(Cons);
                            registration.isRestored = true;
                        }
                    });

                    // https://stackoverflow.com/a/43104489/153209
                    const obj = Reflect.construct(Target, args, NewTarget);
                    registration.contractHandler.assertInvariants(obj);

                    return new Proxy(obj, registration.contractHandler);
                },
                get(target, name): any {
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
                ownKeys(target): PropertyKey[] {
                    const ownSet = new Set(Reflect.ownKeys(target));
                    ownSet.add(IS_PROXY).add(INNER_CLASS);

                    return [...ownSet];
                }
            });

            return ClazzProxy;
        }

        return Clazz != undefined ? decorator(Clazz) : decorator as ClassDecorator;
    }
}