/*!
 * @license
 * Copyright (C) 2020 Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import type {Constructor} from './Constructor';
// TODO: move symbols
export const IS_PROXY = Symbol('Is Proxy');
export const INNER_CLASS = Symbol('Inner Class');

export type DecoratedConstructor = Constructor<any> & {
    [IS_PROXY]?: boolean;
    [INNER_CLASS]?: Constructor<any>;
};