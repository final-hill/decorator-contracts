/*!
 * @license
 * Copyright (C) 2020 Michael L Haufe
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

const isConstructor = (object: any): boolean => {
        const P = new Proxy(object, {
            construct(): object { return this; }
        });
        try {
            return Boolean(new P());
        } catch(e) {
            return false;
        }
    },

    /**
     * Determines if the provided object is a class
     *
     * @param {any} object - The object to test
     * @returns {boolean} - The result of the test
     */
    isClass = (object: any): boolean => isConstructor(object) && String(object).startsWith('class');

export default isClass;