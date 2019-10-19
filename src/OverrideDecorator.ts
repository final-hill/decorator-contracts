/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import DescriptorWrapper from './lib/DescriptorWrapper';
import OverrideHandler, { IS_PROXY } from './lib/OverrideHandler';

const MSG_INVALID_ARG_LENGTH = `An overridden method must have the same number of parameters as its ancestor method`;
const MSG_NO_MATCHING_MEMBER = `This method does not override an ancestor method.`;
const MSG_OVERRIDE_METHOD_ACCESSOR_ONLY = `Only methods and accessors can be overridden.`;
const MSG_DUPLICATE_OVERRIDE = `Only a single @override decorator can be assigned to a class member`;
const MSG_NO_STATIC = `Only instance members can be overridden, not static members`;
const MSG_INVALID_ANCESTOR_METHOD = `A method can only override another method`;

// TODO: symbol and number methods?

/**
 * Finds the nearest ancestor member for the given propertyKey by walking the prototype chain of the target
 *
 * @param assert - The assertion implementation
 * @param targetProto - The prototype of the object
 * @param propertyKey - The name of the member to search for
 * @throws {AssertionError} - if no ancestor member is found
 * @see AssertionError
 */
function _findAncestorMember(assert: typeof Assertion.prototype.assert, targetProto: any, propertyKey: string): DescriptorWrapper | undefined {
    let proto = Object.getPrototypeOf(targetProto);
    if(proto == null) {
        return undefined;
    }
    let ancestorMember = Object.getOwnPropertyDescriptor(proto, propertyKey);

    return ancestorMember != undefined ? new DescriptorWrapper(ancestorMember) : _findAncestorMember(assert, proto, propertyKey);
}

/**
 * Determines if the first argument is a subtype of the second
 *
 * @param a The candidate sub type
 * @param b The candidate base type
 */
function _isSubtypeOf(a: any, b: any): boolean {
    return a instanceof b;
    // TODO
}

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
     * @throws {AssertionError} - If the current member does not have an ancestor
     * @throws {AssertionError} - If the current member is not a method nor an accessor
     * @throws {AssertionError} - If the current member is a method but the ancestor member is not
     * @throws {AssertionError} - If the current member is a method and method.length < ancestorMethod.length
     * @throws {TypeError} - If the decorator is applied to a static member
     * @throws {TypeError} - if this decorator is applied more than once on a class member
     * @see AssertionError
     */
    override = (target: Function | object, propertyKey: string, currentDescriptor: PropertyDescriptor): PropertyDescriptor => {
        if(!this.debugMode) {
            return currentDescriptor;
        }

        let assert = this._assert,
            isStatic = typeof target == 'function',
            // Potentially undefined in pre ES5 environments (compilation target)
            hasDescriptor = currentDescriptor != undefined,
            dw = new DescriptorWrapper(currentDescriptor);

        assert(hasDescriptor, MSG_OVERRIDE_METHOD_ACCESSOR_ONLY, TypeError);
        assert(!isStatic, MSG_NO_STATIC, TypeError);
        assert(dw.isMethod || dw.isProperty || dw.isAccessor);

        let ancestorMember = _findAncestorMember(assert, target, propertyKey)!;
        assert(ancestorMember != undefined, MSG_NO_MATCHING_MEMBER);

        if(dw.isMethod) {
            assert(ancestorMember.isMethod, MSG_INVALID_ANCESTOR_METHOD);
            let thisMethod: Function & {[IS_PROXY]: boolean} = dw.value,
                ancMethod: Function = ancestorMember.value;
            assert(thisMethod.length == ancMethod.length, MSG_INVALID_ARG_LENGTH);
            assert(!thisMethod[IS_PROXY], MSG_DUPLICATE_OVERRIDE);

            let newDescriptor: PropertyDescriptor = Object.create(dw.value);
            newDescriptor.value = new Proxy(thisMethod, new OverrideHandler(dw.value));

            return newDescriptor;
        } else if (dw.isProperty) {
            // TODO: Do nothing here?
            let thisValue = currentDescriptor.value,
                ancValue = ancestorMember.value;
            assert(_isSubtypeOf(thisValue, ancValue));

            return dw.value;
        } else { // isAccessor
            return dw.value;
            // TODO
        }
    }
}