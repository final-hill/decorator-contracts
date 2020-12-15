/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

class ClassRegistration {
    isRestored = false;
}

class ClassRegistry extends WeakMap<Constructor<any>, ClassRegistration> {
    get(Class: Constructor<any>): ClassRegistration | undefined {
        //return super.get(innerClass(Class));
        return super.get(Class);
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
        //return super.delete(innerClass(Class));
        return super.delete(Class);
    }

    has(Class: Constructor<any>): boolean {
        //return super.has(innerClass(Class));
        return super.has(Class);
    }

    set(Class: Constructor<any>, classRegistration: ClassRegistration): this {
        //super.set(innerClass(Class), classRegistration);
        super.set(Class, classRegistration);

        return this;
    }
}

const CLASS_REGISTRY = new ClassRegistry();

export default CLASS_REGISTRY;