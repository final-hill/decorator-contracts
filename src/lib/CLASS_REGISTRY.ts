/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import type { Constructor } from '../typings/Constructor';
import { PredicateType } from '../typings/PredicateType';
import ContractHandler from '../ContractHandler';
import Assertion from '../Assertion';

export class ClassRegistration {
    readonly contractHandler = new ContractHandler(new Assertion(true).assert);
    readonly invariants: PredicateType[] = [];
    isRestored = false;
}

/**
 * Manages the contracts and metadata assocated with a class
 */
class ClassRegistry extends WeakMap<Constructor<any>, ClassRegistration> {
    getOrCreate(key: Constructor<any>): ClassRegistration {
        if(this.has(key)) {
            return this.get(key)!;
        } else {
            this.set(key, new ClassRegistration());

            return this.get(key)!;
        }
    }
}

export const CLASS_REGISTRY = new ClassRegistry();