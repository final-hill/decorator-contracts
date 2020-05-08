/*!
 * @license
 * Copyright (C) 2021 Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

export const ASSERTION_FAILED = 'Assertion failure';
export const MSG_NO_STATIC = 'Only instance members can be decorated, not static members';
export const MSG_DECORATE_METHOD_ACCESSOR_ONLY = 'Only methods and accessors can be decorated.';
export const MSG_INVARIANT_REQUIRED = 'An @invariant must be defined on the current class or one of its ancestors';
export const MSG_INVALID_DECORATOR = 'Invalid decorator declaration';
export const MSG_SINGLE_RETRY = 'retry can only be called once';
export const MSG_INVALID_ARG_LENGTH = 'An overridden method must have the same number of parameters as its ancestor method';
export const MSG_NO_MATCHING_FEATURE = 'This feature does not override an ancestor feature.';
export const MSG_DUPLICATE_OVERRIDE = 'Only a single @override decorator can be assigned to a class member';
export const MSG_DUPLICATE_RESCUE = 'Only a single @rescue can be assigned to a feature';
export const MSG_NO_PROPERTY_RESCUE = 'A property can not be assigned a @rescue';