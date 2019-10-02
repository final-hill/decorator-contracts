/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
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
    protected _findAncestorMember = (targetProto: any, propertyKey: string): PropertyDescriptor => {
        let assert = this._assert;
        let proto = Object.getPrototypeOf(targetProto);
        assert(proto != null, MSG_NO_SUPER);
        let ancestorMember = Object.getOwnPropertyDescriptor(proto, propertyKey);

        return ancestorMember != undefined ? ancestorMember : this._findAncestorMember(proto, propertyKey);
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
    override = (target: Function | object, propertyKey: string, currentDescriptor: PropertyDescriptor): PropertyDescriptor | void => {
        if(!this.debugMode) {
            return undefined;
        }

        let assert = this._assert,
            isStatic = typeof target == 'function',
            hasDescriptor = currentDescriptor != undefined,
            isMethod = typeof currentDescriptor.value == 'function',
            isProperty = typeof currentDescriptor.value != 'function' &&
                             typeof currentDescriptor.value != 'undefined',
            isAccessor = typeof currentDescriptor == 'undefined';

        assert(!isStatic, MSG_NO_STATIC, TypeError);
        // Potentially undefined in pre ES5 environments
        assert(hasDescriptor, MSG_OVERRIDE_METHOD_ACCESSOR_ONLY, TypeError);
        assert(isMethod || isProperty || isAccessor);

        let thunkDescriptor: PropertyDescriptor = {

        };

        // TODO: need to save old descriptor until @invariant can register it
        // Save in a global registry?
        // Save on the target?
        //    if so, how does an ancestor invariant register it?
        //    it wouldn't until construction?

        let ancestorMember = this._findAncestorMember(
            Object.getPrototypeOf(target), propertyKey
        );

        if(isMethod) {

            // TODO
        } else if (isProperty) {
            // TODO: becomes accessor
            // getter/setter throw
        } else {
            // TODO
        }

        return thunkDescriptor;

        /*
        assert(!Boolean((currentDescriptor as any)[OVERRIDE_SYMBOL]), MSG_MULTIPLE_OVERRIDE, TypeError);

        let isMethodDecorator = currentDescriptor.value != undefined;
        let ancestorDescriptor = this.findAncestorMember(target, propertyKey);
        */
        // TODO: check as part of dynamic contract assignment API
        /*
        if(currentDescriptor.configurable) {}

        if(currentDescriptor.enumerable) {}

        if(currentDescriptor.writable){}
        */

        /*
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
        */
    }
}