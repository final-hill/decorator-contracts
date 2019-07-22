/*!
 * Decorator Contracts v0.0.0 | Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import assertion from './assertion';

let assert = assertion(true);
const OVERRIDE_SYMBOL = Symbol('override assigned');
const MSG_NO_SUPER = `This class member does not override an ancestor member`;
const MSG_INVALID_ARG_LENGTH = `An overridden method must have an equal or greater number of arguments than its ancestor method`;
const MSG_NO_MATCHING_METHOD = `This method does not override an ancestor method. The ancestor is not a method`;
const MSG_OVERRIDE_METHOD_ACCESSOR_ONLY = `Only methods and accessors can be overridden.`;
const MSG_MULTIPLE_OVERRIDE = `Only a single @overreide decorator can be assigned to a class member`;
// TODO: what are the semantics of static override, if any?
// constructor is a static member for instance, so only @invariant applies
const MSG_NO_STATIC = `Only instance members can be overridden, not static members`;
// TODO: does decorating a constructor throw an exception in Babel and browsers?

// TODO: when @override or the other decorators are assigned, is the member now immutable?
// TODO: contract propagation

/**
 * Finds the nearest ancestor member for the given propertyKey by walking the prototype chain of the target
 *
 * @param targetProto - The prototype of the object
 * @param propertyKey - The name of the member to search for
 * @throws {AssertionError} - if no ancestor member is found
 * @see AssertionError
 */
function findAncestorMember(targetProto: any, propertyKey: string): PropertyDescriptor {
    let proto = Object.getPrototypeOf(targetProto);
    assert(proto != null, MSG_NO_SUPER);
    let ancestorMember = Object.getOwnPropertyDescriptor(targetProto, propertyKey);

    return ancestorMember != undefined ? ancestorMember : findAncestorMember(proto, propertyKey);
}

/**
 * The 'override' decorator asserts that the current class member is a specialized instance of
 * an ancestor class's member of the same name.
 *
 * @throws {AssertionError} - if the current member does not have an ancestor
 * @throws {AssertionError} - if the current member is not a method nor an accessor
 * @throws {AssertionError} - if the current member is a method but the ancestor member is not
 * @throws {AssertionError} - if the current member is a method and method.length < ancestorMethod.length
 * @throws {AssertionError} - if this decorator is applied more than once on a class member
 * @see AssertionError
 */
function overrideDebug(target: any, propertyKey: string, currentDescriptor: PropertyDescriptor) {
    assert(typeof target != 'function', MSG_NO_STATIC);
    assert(currentDescriptor != undefined, MSG_OVERRIDE_METHOD_ACCESSOR_ONLY);
    // TODO: throw TypeError
    assert(!Boolean((currentDescriptor as any)[OVERRIDE_SYMBOL]), MSG_MULTIPLE_OVERRIDE);

    let ancestorDescriptor = findAncestorMember(target, propertyKey);

    // TODO: check as part of dynamic contract assignment API
    /*
    if(currentDescriptor.configurable) {}

    if(currentDescriptor.enumerable) {}

    if(currentDescriptor.writable){}
    */

    // Method decorator if the currentDescriptor is present due to assertion above
    if(currentDescriptor.value != undefined) {
        assert(typeof currentDescriptor.value == 'function', MSG_OVERRIDE_METHOD_ACCESSOR_ONLY);
        assert(typeof ancestorDescriptor.value == 'function', MSG_NO_MATCHING_METHOD);
        assert(currentDescriptor.value.length >= ancestorDescriptor.value!.length, MSG_INVALID_ARG_LENGTH);

        // Writable
        // TODO: if(currentDescriptor.writable) {}
    } else  {
        if(currentDescriptor.get != undefined && ancestorDescriptor.get != undefined) {
            // TODO:
        }
        if(currentDescriptor.set != undefined && ancestorDescriptor.set != undefined) {
            // TODO
        }
    }

    (currentDescriptor as any)[OVERRIDE_SYMBOL] = true;
}

function overrideProd(_targetProto: any, _propertyKey: string, _descriptor: PropertyDescriptor) {}

/**
 * Returns an instance of the 'override' decorator in the specified mode.
 * When debugMode is true the decorator is enabled. When debugMode is false the decorator has no effect
 *
 * @param debugMode - A flag representing mode of the decorator
 */
export default function overrideFactory(debugMode: boolean) {
    return debugMode ? overrideDebug : overrideProd;
}

export {OVERRIDE_SYMBOL};