/*!
 * @license
 * Copyright (C) 2022 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

/**
 * Constructs a type representing a class
 */
type Constructor<T> = new (...args: any[]) => T;
type AbstractConstructor<T> = abstract new (...args: any[]) => T;
export type ClassType<T> = Constructor<T> | AbstractConstructor<T>;
