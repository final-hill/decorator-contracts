/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import DescriptorWrapper from './lib/DescriptorWrapper';

export const MSG_NO_STATIC = `Only instance members can be decorated, not static members`;
export const MSG_DECORATE_METHOD_ACCESSOR_ONLY = `Only methods and accessors can be decorated.`;
export const MSG_NO_MATCHING_MEMBER = `This member does not have an ancestor.`;
export const MSG_INVARIANT_REQUIRED = 'An @invariant must be defined on the current class or one of its ancestors';

export default abstract class MemberDecorator {
    protected _assert: typeof Assertion.prototype.assert;
    protected _checkedAssert = new Assertion(true).assert;
    protected _uncheckedAssert = new Assertion(false).assert;

    /**
     * Returns an instance of the decorator in the specified mode.
     * When debugMode is true the decorator is enabled.
     * When debugMode is false the decorator has no effect
     *
     * @param debugMode - A flag representing mode of the decorator
     */
    constructor(protected debugMode: boolean) {
        this._assert = debugMode ? this._checkedAssert : this._uncheckedAssert;
    }

    /**
     * Finds the nearest ancestor member for the given propertyKey by walking the prototype chain of the target
     *
     * @param assert - The assertion implementation
     * @param targetProto - The prototype of the object
     * @param propertyKey - The name of the member to search for
     * @throws {AssertionError} - if no ancestor member is found
     * @see AssertionError
     */
    protected _findAncestorMember(targetProto: any, propertyKey: PropertyKey): DescriptorWrapper {
        let proto = Object.getPrototypeOf(targetProto);
        this._assert(proto != undefined, MSG_NO_MATCHING_MEMBER);
        let ancestorMember = Object.getOwnPropertyDescriptor(proto, propertyKey);

        return ancestorMember != undefined ? new DescriptorWrapper(ancestorMember) : this._findAncestorMember(proto, propertyKey);
    }
}