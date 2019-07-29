/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * The requires decorator is an assertion of a precondition.
 * It expresses a condition that must be true before the associated class member is executed.
 */

import assertion from './assertion';

function requiresDebug<Self>(
    fnCondition: (self: Self, ...args: any[]) => boolean,
    message: string = 'Precondition failed') {
    let assert = assertion(true);

    return function(_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
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

// @ts-ignore: ignoring unused
function requiresProd<Self>(fnCondition: (self: Self, ...args: any[]) => boolean, message: string = 'Precondition failed') {
    return function(_target: any, _propertyKey: string, _descriptor: PropertyDescriptor) {};
}

/**
 *
 * @param debugMode
 */
export default function requiresFactory(debugMode: boolean) {
    let requires = debugMode ? requiresDebug : requiresProd;

    return requires;
}