/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

export const ASSERTION_FAILED = 'Assertion failure';
export const MSG_NO_STATIC = 'Only instance members can be decorated, not static members';
export const MSG_NO_PROPERTIES = 'Public properties are forbidden';
export const MSG_NOT_CONTRACTED = 'The current class or one of its ancestors must declare @Contracted(...)';
export const MSG_MISSING_FEATURE = 'The requested feature is not registered';
export const MSG_SINGLE_CONTRACT = 'Only a single @Contracted decorator is allowed per class';
export const MSG_SINGLE_RETRY = 'retry can only be called once';
export const MSG_INVALID_CONTEXT = 'A contracted feature can not be applied to objects of a different base class';
export const MSG_BAD_SUBCONTRACT = 'A sub contract must extend a base contract';