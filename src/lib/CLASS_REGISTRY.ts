/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import type { Constructor } from '../typings/Constructor';
import { PredicateType } from '../typings/PredicateType';
import ContractHandler from '../ContractHandler';
import Assertion from '../Assertion';
import { FeatureRegistry } from './FeatureRegistry';
import { IS_PROXY, INNER_CLASS, DecoratedConstructor } from '../typings/DecoratedConstructor';

export class ClassRegistration {
    readonly contractHandler = new ContractHandler(new Assertion(true).assert);
    readonly featureRegistry: FeatureRegistry = new FeatureRegistry();
    readonly invariants: PredicateType[] = [];
    isRestored = false;
}

/**
 * If the provided constructor is a ClazzProxy return the inner class
 * else just return the provided object
 *
 * @param {Constructor<any>} Cons - The constructor to evaluate
 * @returns {Constructor<any>} The decorated class
 */
function innerClass(Cons: Constructor<any> | DecoratedConstructor): Constructor<any> {
    if(Object.getOwnPropertySymbols(Cons).includes(IS_PROXY)) {
        // TODO: remove cast
        return (Cons as DecoratedConstructor)[INNER_CLASS]!;
    } else {
        return Cons;
    }
}

/**
 * Manages the contracts and metadata assocated with a class
 */
class ClassRegistry extends WeakMap<Constructor<any>, ClassRegistration> {
    get(Class: Constructor<any>): ClassRegistration | undefined {
        return super.get(innerClass(Class));
    }

    /**
     * Returns the class registry defined for the current class.
     * If the registry is undefined, a new one is created
     *
     * @param {Constructor<any>} Class - The class
     * @returns {ClassRegistration} - The ClassRegistration
     */
    getOrCreate(Class: Constructor<any>): ClassRegistration {
        if(this.has(Class)) {
            return this.get(Class)!;
        } else {
            this.set(Class, new ClassRegistration());

            return this.get(Class)!;
        }
    }

    delete(Class: Constructor<any>): boolean {
        return super.delete(innerClass(Class));
    }

    has(Class: Constructor<any>): boolean {
        return super.has(innerClass(Class));
    }

    set(Class: Constructor<any>, classRegistration: ClassRegistration): this {
        super.set(innerClass(Class), classRegistration);

        return this;
    }
}

export const CLASS_REGISTRY = new ClassRegistry();