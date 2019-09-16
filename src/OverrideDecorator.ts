/**
 * @license
 * Copyright (C) __YEAR__ Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

// TODO: does decorating a constructor throw an exception in Babel and browsers?
// TODO: when @override or the other decorators are assigned, is the member now immutable?
// TODO: contract propagation

import Assertion from './Assertion';

export const OVERRIDE_SYMBOL = Symbol('override assigned');
const MSG_NO_SUPER = `This class member does not override an ancestor member`;
const MSG_INVALID_ARG_LENGTH = `An overridden method must have an equal or greater number of arguments than its ancestor method`;
const MSG_NO_MATCHING_METHOD = `This method does not override an ancestor method. The ancestor is not a method`;
const MSG_OVERRIDE_METHOD_ACCESSOR_ONLY = `Only methods and accessors can be overridden.`;
const MSG_MULTIPLE_OVERRIDE = `Only a single @override decorator can be assigned to a class member`;
const MSG_NO_STATIC = `Only instance members can be overridden, not static members`;

/**
 * The 'override' decorator asserts that the current class member is a specialized instance of
 * an ancestor class's member of the same name.
 *
 */
export default class OverrideDecorator {
    protected _assert: typeof Assertion.prototype.assert;

    /**
     * Returns an instance of the 'override' decorator in the specified mode.
     * When debugMode is true the decorator is enabled. When debugMode is false the decorator has no effect
     *
     * @param debugMode - A flag representing mode of the decorator
     */
    constructor(protected debugMode: boolean) {
        this._assert = new Assertion(debugMode).assert;
    }

    /**
     * Finds the nearest ancestor member for the given propertyKey by walking the prototype chain of the target
     *
     * @param targetProto - The prototype of the object
     * @param propertyKey - The name of the member to search for
     * @throws {AssertionError} - if no ancestor member is found
     * @see AssertionError
     */
    findAncestorMember = (targetProto: any, propertyKey: string): PropertyDescriptor => {
        let assert = this._assert;
        let proto = Object.getPrototypeOf(targetProto);
        assert(proto != null, MSG_NO_SUPER);
        let ancestorMember = Object.getOwnPropertyDescriptor(proto, propertyKey);

        return ancestorMember != undefined ? ancestorMember : this.findAncestorMember(proto, propertyKey);
    }

    /**
     * @throws {AssertionError} - If the current member does not have an ancestor
     * @throws {AssertionError} - If the current member is not a method nor an accessor
     * @throws {AssertionError} - If the current member is a method but the ancestor member is not
     * @throws {AssertionError} - If the current member is a method and method.length < ancestorMethod.length
     * @throws {TypeError} - If the decorator is applied to a static member
     * @throws {TypeError} - if this decorator is applied more than once on a class member
     * @see AssertionError
     */
    override = (target: any, propertyKey: string, currentDescriptor: PropertyDescriptor): void => {
        if(!this.debugMode) {
            return;
        }
        let assert = this._assert;
        assert(typeof target != 'function', MSG_NO_STATIC, TypeError);
        assert(currentDescriptor != undefined, MSG_OVERRIDE_METHOD_ACCESSOR_ONLY);
        assert(!Boolean((currentDescriptor as any)[OVERRIDE_SYMBOL]), MSG_MULTIPLE_OVERRIDE, TypeError);

        let isMethodDecorator = currentDescriptor.value != undefined;
        let ancestorDescriptor = this.findAncestorMember(target, propertyKey);

        // TODO: check as part of dynamic contract assignment API
        /*
        if(currentDescriptor.configurable) {}

        if(currentDescriptor.enumerable) {}

        if(currentDescriptor.writable){}
        */

        if(isMethodDecorator) {
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
}