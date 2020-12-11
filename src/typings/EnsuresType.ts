/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

type NonFunctionPropertyNames<T> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T];
type Properties<T> = Pick<T, NonFunctionPropertyNames<T>>;

export type EnsuresType<S extends object> = (self: S, old: Properties<S>, ...args: any[]) => boolean;