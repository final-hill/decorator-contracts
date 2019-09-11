/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import Assertion from './Assertion';

/**
 * The invariant decorator is an assertion of conditions that must be maintained
 * by all members of a class. This condition is checked after the associated
 * class is constructed, before and after every method execution, and before
 * and after every property assignment
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

        const invariantHandler = {
            get(target: any, prop: any) {
                let feature = target[prop];
                if(typeof feature == 'function') {
                    return function() {
                        assert(fnCondition(target), message);
                        let result = feature.apply(target, arguments);
                        assert(fnCondition(target), message);

                        return result;
                    };
                } else {
                    return feature;
                }
            },
            set(target: any, prop: any, value: any) {
                assert(fnCondition(target), message);
                target[prop] = value;
                assert(fnCondition(target), message);

                return true;
            }
        };

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