/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import DescriptorWrapper from './lib/DescriptorWrapper';

export const OVERRIDE_LIST = Symbol('Override List');
export const MSG_INVALID_ARG_LENGTH = `An overridden method must have the same number of parameters as its ancestor method`;
export const MSG_NO_MATCHING_MEMBER = `This method does not override an ancestor method.`;
export const MSG_OVERRIDE_METHOD_ACCESSOR_ONLY = `Only methods and accessors can be overridden.`;
export const MSG_DUPLICATE_OVERRIDE = `Only a single @override decorator can be assigned to a class member`;
export const MSG_NO_STATIC = `Only instance members can be overridden, not static members`;

/**
 * Finds the nearest ancestor member for the given propertyKey by walking the prototype chain of the target
 *
 * @param assert - The assertion implementation
 * @param targetProto - The prototype of the object
 * @param propertyKey - The name of the member to search for
 * @throws {AssertionError} - if no ancestor member is found
 * @see AssertionError
 */
function _findAncestorMember(assert: typeof Assertion.prototype.assert, targetProto: any, propertyKey: PropertyKey): DescriptorWrapper | undefined {
    let proto = Object.getPrototypeOf(targetProto);
    if(proto == null) {
        return undefined;
    }
    let ancestorMember = Object.getOwnPropertyDescriptor(proto, propertyKey);

    return ancestorMember != undefined ? new DescriptorWrapper(ancestorMember) : _findAncestorMember(assert, proto, propertyKey);
}

/**
 * The 'override' decorator asserts that the current class member is a specialized instance of
 * an ancestor class's member of the same name
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
     * The override decorator specifies that the associated method replaces
     * a method of the same name in an ancestor class.
     */
    override = (target: Function | object, propertyKey: PropertyKey, currentDescriptor: PropertyDescriptor): PropertyDescriptor => {
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

        let am = _findAncestorMember(assert, target, propertyKey)!;
        assert(am != undefined, MSG_NO_MATCHING_MEMBER);

        let Clazz = (target as any).constructor,
            overrides = Object.getOwnPropertySymbols(Clazz).includes(OVERRIDE_LIST) ?
                Clazz[OVERRIDE_LIST]! : Clazz[OVERRIDE_LIST] = new Set();

        assert(!overrides.has(propertyKey), MSG_DUPLICATE_OVERRIDE);
        overrides.add(propertyKey);

        assert(dw.memberType === am.memberType, MSG_NO_MATCHING_MEMBER);

        if(dw.isMethod) {
            let thisMethod: Function = dw.value,
                ancMethod: Function = am.value;
            assert(thisMethod.length == ancMethod.length, MSG_INVALID_ARG_LENGTH);
        }

        // TODO: subtyping assertions?
        // TODO: writable | configurable | enumerable verification

        return dw.descriptor;
    }
}