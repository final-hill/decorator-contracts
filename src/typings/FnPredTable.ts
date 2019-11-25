/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

type FnPredTable<T> = (ctx: T) => { [attribute: string]: boolean };

export default FnPredTable;