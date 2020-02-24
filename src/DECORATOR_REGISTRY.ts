/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import type {Constructor} from './typings/Constructor';
import type {FnPredTable} from './typings/FnPredTable';

export interface IDecoratorRegistration {
    /**
     * TODO: Description
     */
    isRestored: boolean
    invariant: FnPredTable<any>
}

/**
 * TODO: Description
 */

export const DECORATOR_REGISTRY = new WeakMap<Constructor<any>, IDecoratorRegistration>();