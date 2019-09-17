/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

 /**
  * Constructs a type representing a constructor
  */
type Constructor<T> = new(...args: any[]) => T;