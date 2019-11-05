/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

type FnPredTable<T> = (ctx: T) => { [attribute: string]: boolean };

export default FnPredTable;