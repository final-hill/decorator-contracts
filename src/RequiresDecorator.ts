/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * The requires decorator is an assertion of a precondition.
 * It expresses a condition that must be true before the associated class member is executed.
 */

import Assertion from './Assertion';

type PropertyKey = string | number | symbol;

const MSG_INVALID_DECORATOR = 'Invalid decorator declaration';
const MSG_OLD_ES = 'Unable to declare decorator in this version of ECMAScript';

/**
 * The `@requires` decorator is an assertion of a precondition.
 * It expresses a condition that must be true before the associated class member is executed.
 */
export default class RequiresDecorator {
    protected _assert: typeof Assertion.prototype.assert;

    /**
     * Constructs a new instance of the RequiresDecorator in the specified mode
     * Enabled when checkMode is true, and disabled otherwise
     *
     * @param checkMode - The flag representing mode of the assertion
     */
    constructor(protected checkMode: boolean) {
        this._assert =  new Assertion(checkMode).assert;
    }

    /**
     * TODO
     */
    requires = <Self>(
        fnCondition: (self: Self, ...args: any[]) => boolean,
        message: string = 'Precondition failed'
    ) => {
        let assert = this._assert,
            checkMode = this.checkMode;

        return function(target: any, propertyKey: PropertyKey, descriptor: PropertyDescriptor) {
            assert(typeof target == 'object', MSG_INVALID_DECORATOR);
            assert(['string', 'symbol', 'number'].includes(typeof propertyKey), MSG_INVALID_DECORATOR);
            // The Property Descriptor will be undefined if the script target is less than ES5.
            assert(descriptor != undefined, MSG_OLD_ES);

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