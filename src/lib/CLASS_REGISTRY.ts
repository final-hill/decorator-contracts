/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {ClassRegistration, Constructor} from './';

/**
 * A WeakMap that tracks class registrations.
 * @see ClassRegistration
 */
class ClassRegistry extends WeakMap<Constructor<any>, ClassRegistration> {
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
            this.set(Class, new ClassRegistration(Class));

            return this.get(Class)!;
        }
    }
}

const CLASS_REGISTRY = new ClassRegistry();

export default CLASS_REGISTRY;