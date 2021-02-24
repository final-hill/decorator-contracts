/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import ClassRegistration from './ClassRegistration';

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

class ClassRegistry extends WeakMap<Constructor<any>, ClassRegistration> {
    get(Class: Constructor<any>): ClassRegistration | undefined {
        const cls = innerClass(Class);

        return super.get(cls);
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
            this.set(Class, new ClassRegistration(innerClass(Class)));

            return this.get(Class)!;
        }
    }

    delete(Class: Constructor<any>): boolean {
        const cls = innerClass(Class);

        return super.delete(cls);
    }

    has(Class: Constructor<any>): boolean {
        const cls = innerClass(Class);

        return super.has(cls);
    }

    set(Class: Constructor<any>, classRegistration: ClassRegistration): this {
        const cls = innerClass(Class);
        super.set(cls, classRegistration);

        return this;
    }
}

const CLASS_REGISTRY = new ClassRegistry();

export default CLASS_REGISTRY;