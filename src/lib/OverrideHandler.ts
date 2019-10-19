/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

const MSG_NO_INVARIANT = `An @invariant must be defined on this class or an ancestor class`;
export const IS_PROXY = Symbol('IsProxy');
export const ORIGINAL_DESCRIPTOR = Symbol('Orignal Descriptor');

/**
 * Constructs a Proxy Handler for override methods.
 * Intercepts calls to overridden methods and throws an error
 * until the wrapping class invariant can register it.
 * See Requirement 346
 */
export default class OverrideHandler<T extends object> implements ProxyHandler<T> {
    constructor(
        protected _originalDescriptor: PropertyDescriptor
    ) {}

    get(_target: T, key: string | number | symbol) {
        switch(key) {
            case IS_PROXY: return true;
            case ORIGINAL_DESCRIPTOR: return this._originalDescriptor;
            default: return undefined;
        }
    }
    apply() {
        throw new Error(MSG_NO_INVARIANT);
    }
}