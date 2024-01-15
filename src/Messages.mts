/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

export enum Messages {
    AssertionFailed = 'Assertion failure',
    MsgNoProperties = 'Public properties are forbidden',
    MsgNotContracted = 'The current class or one of its ancestors must declare @Contracted(...)',
    MsgMissingFeature = 'The requested feature is not registered',
    MsgSingleContract = 'Only a single @Contracted decorator is allowed per class',
    MsgSingleRetry = 'retry can only be called once',
    MsgInvalidContext = 'A contracted feature can not be applied to objects of a different base class',
    MsgBadSubcontract = 'A sub contract must extend a base contract'
}