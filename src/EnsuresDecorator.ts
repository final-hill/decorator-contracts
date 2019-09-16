/**
 * @license
 * Copyright (C) __YEAR__ Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * The ensures decorator is an assertion of a postcondition.
 * It expresses a condition that must be true after the associated class member is executed.
 */

import Assertion from './Assertion';

export default class EnsuresDecorator {
    protected _assert: typeof Assertion.prototype.assert;

    constructor(protected debugMode: boolean) {
        this._assert = new Assertion(debugMode).assert;
    }

    ensures = <Self>(fnCondition: (self: Self, returnValue: any) => boolean, message: string = 'Postcondition failed') => {
        let assert = this._assert,
            debugMode = this.debugMode;

        return function(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
            if(!debugMode) {
                return;
            }
            let {value, get, set} = descriptor;

            if(value != undefined) {
                descriptor.value = function (this: Self, ...args: any[]) {
                    let result = value.apply(this, args);
                    assert(fnCondition(this, result), message);

                    return result;
                };
            } else {
                if(get != undefined) {
                    descriptor.get = function(this: Self) {
                        let result = get!.apply(this);
                        assert(fnCondition(this, result), message);

                        return result;
                    };
                }
                if(set != undefined) {
                    descriptor.set = function(this: Self, arg: any) {
                        let result = set!.call(this, arg);
                        assert(fnCondition(this, arg), message);

                        return result;
                    };
                }
            }
        };
    }
}