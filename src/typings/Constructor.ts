/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
*/

 /**
  * Constructs a type representing a constructor
  */
export type Constructor<T> = new(...args: any[]) => T;