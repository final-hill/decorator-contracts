/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

export enum Messages {
    AssertionFailed = 'Assertion failure',
    MsgInvalidArgLength = 'An overridden method must have the same number of parameters as its ancestor method',
    MsgNoStatic = 'Only instance members can be decorated, not static members',
    MsgNoMatchingFeature = 'This feature does not override an ancestor feature.',
    MsgDuplicateOverride = 'Only a single @override decorator can be assigned to a class member',
    MsgNoProperties = 'Public properties are forbidden',
    MsgNotContracted = 'The current class or one of its ancestors must declare @Contracted(...)',
    MsgMissingFeature = 'The requested feature is not registered',
    MsgSingleContract = 'Only a single @Contracted decorator is allowed per class',
    MsgSingleRetry = 'retry can only be called once',
    MsgInvalidContext = 'A contracted feature can not be applied to objects of a different base class',
    MsgBadSubcontract = 'A sub contract must extend a base contract'
}