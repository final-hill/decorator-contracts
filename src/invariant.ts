/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * The invariant decorator is an assertion of conditions that must be maintained by all members of a class.
 * This condition is checked after the associated class is constructed and also before and after every method execution.
 */

import Assertion from './assertion';

let assert = new Assertion(true).assert;

// TODO: what about static members?

function invariantDebug<Self>(
    fnCondition: (self: Self) => boolean,
    message: string = 'Invariant violated') {
    return function<T extends new(...args: any[]) => {}>(Constructor: T) {
        let InvariantClass = class extends Constructor {
            constructor(...args: any[]) {
                super(...args);
                assert(fnCondition(this as any), message);
            }
        };

        // Decorate every
        const props = Object.getOwnPropertyDescriptors(Constructor.prototype);
        Object.entries(props).filter(([key, _]: [string, PropertyDescriptor]) => {
            return key !== 'constructor';
        }).forEach(([_key, descriptor]: [string, PropertyDescriptor]) => {
            let {value, get, set} = descriptor;

            if(value != undefined) {
                descriptor.value = function (this: Self, ...args: any[]) {
                    assert(fnCondition(this), message);
                    let result = value.apply(this, args);
                    assert(fnCondition(this), message);

                    return result;
                };
            } else {
                if(get != undefined) {
                    descriptor.get = function(this: Self) {
                        assert(fnCondition(this), message);
                        let result = get!.apply(this);
                        assert(fnCondition(this), message);

                        return result;
                    };
                }
                if(set != undefined) {
                    descriptor.set = function(this: Self, arg: any) {
                        assert(fnCondition(this), message);
                        let result = set!.call(this, arg);
                        assert(fnCondition(this), message);

                        return result;
                    };
                }
            }
        });

        return InvariantClass;
    };
}

// @ts-ignore: Ignoring unused variables
function invariantProd(fnCondition: () => boolean, message: string = 'Invariant violated') {
    return function<T extends new(...args: any[]) => {}>(_Constructor: T) { };
}

export default function invariantFactory(debugMode: boolean) {
    let invariant = debugMode ? invariantDebug : invariantProd;

    return invariant;
}