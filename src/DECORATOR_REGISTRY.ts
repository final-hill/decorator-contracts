/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
*/


import type {Constructor} from './typings/Constructor';
import { PredicateType } from './typings/PredicateType';
import ContractHandler from './ContractHandler';
import Assertion from './Assertion';

export interface DecoratorRegistration {
    contractHandler: ContractHandler;
    /**
     * TODO: Description
     */
    isRestored: boolean;
    invariants: PredicateType[];
}

const {assert} = new Assertion(true);

/**
 * Manages the contracts and metadata assocated with a class or feature
 */
class DecoratorRegistry extends WeakMap<Constructor<any>, DecoratorRegistration> {
    getOrCreate(key: Constructor<any>): DecoratorRegistration {
        if(this.has(key)) {
            return this.get(key)!;
        } else {
            this.set(key, {
                contractHandler: new ContractHandler(assert),
                invariants: [],
                isRestored: false
            });

            return this.get(key)!;
        }
    }
}

export const DECORATOR_REGISTRY = new DecoratorRegistry();