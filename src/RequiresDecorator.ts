/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * The requires decorator is an assertion of a precondition.
 * It expresses a condition that must be true before the associated class member is executed.
 */

import Assertion from './Assertion';

export default class RequiresDecorator {
    protected _assert: typeof Assertion.prototype.assert;

    /**
     * Constructs a new instance of the RequiresDecorator int he specified mode
     * Enabled when checkMode is true, and disabled otherwise
     *
     * @param checkMode - The flag representing mode of the assertion
     */
    constructor(protected checkMode: boolean) {
        this._assert =  new Assertion(checkMode).assert;
    }

    requires = <Self>(
        fnCondition: (self: Self, ...args: any[]) => boolean,
        message: string = 'Precondition failed'
    ) => {
        let assert = this._assert,
            checkMode = this.checkMode;

        return function(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
            if(!checkMode) {
                return;
            }
            let {value, get, set} = descriptor;

            if(value != undefined) {
                descriptor.value = function (this: Self, ...args: any[]) {
                    assert(fnCondition(this, ...args), message);

                    return value.apply(this, args);
                };
            } else {
                if(get != undefined) {
                    descriptor.get = function(this: Self) {
                        assert(fnCondition(this), message);

                        return get!.apply(this);
                    };
                }
                if(set != undefined) {
                    descriptor.set = function(this: Self, arg: any) {
                        assert(fnCondition(this), message);

                        return set!.call(this, arg);
                    };
                }
            }
        };
    }
}