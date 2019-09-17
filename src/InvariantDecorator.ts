/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import Assertion from './Assertion';

class InvariantHandler {
    constructor(
        protected _assert: typeof Assertion.prototype.assert,
        protected _predicate: (self: any) => boolean,
        protected _message: string
    ) {}
    protected _decorated(feature: any, target: any) {
        this._assert(this._predicate(target), this._message);
        let result = feature.apply(target, arguments);
        this._assert(this._predicate(target), this._message);

        return result;
    }
    get(target: any, prop: any) {
        let feature = target[prop];

        return typeof feature == 'function' ?
            this._decorated.bind(this, feature, target) :
            feature;
    }
    set(target: any, prop: any, value: any) {
        this._assert(this._predicate(target), this._message);
        target[prop] = value;
        this._assert(this._predicate(target), this._message);

        return true;
    }
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
    }

    invariant = <Self>(
        fnCondition: (self: Self) => boolean,
        message: string = 'Invariant violated'
    ) => {
        let assert = this._assert,
            debugMode = this.debugMode;

        const invariantHandler = new InvariantHandler(assert, fnCondition, message);

        return function<T extends new(...args: any[]) => {}>(Constructor: T) {
            // TODO: if invariantRegistry, update and return

            if(!debugMode) {
                return Constructor;
            }
            class InvariantClass extends Constructor {
                // TODO: requiresRegistry
                // TODO: rescueRegistry
                // TODO: ensuresRegistry
                constructor(...args: any[]) {
                    super(...args);
                    assert(fnCondition(this as any), message);

                    return new Proxy(this, invariantHandler);
                }
            }

            return InvariantClass;
        };
    }
}