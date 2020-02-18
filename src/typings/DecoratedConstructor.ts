/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Constructor from './Constructor';
import { DECORATOR_REGISTRY, DecoratorRegistry } from '../lib/DecoratorRegistry';
import { ContractHandler, CONTRACT_HANDLER } from '../ContractHandler';

export const IS_PROXY = Symbol('Is Proxy');
export const INNER_CLASS = Symbol('Inner Class');

// TODO: deprecate. move to registry

export type DecoratedConstructor = Constructor<any> & {
    [DECORATOR_REGISTRY]?: DecoratorRegistry
    [CONTRACT_HANDLER]: ContractHandler
    [IS_PROXY]?: boolean
    [INNER_CLASS]?: Constructor<any>
};