/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

/**
 * Determines if the provided object is a constructor
 */
const isConstructor = (object: any): boolean => {
    let P = new Proxy(object, {
        construct() { return this; }
    });
    try {
        return Boolean(new P());
    } catch(e) {
        return false;
    }
};

/**
 * Determines if the provided object is a class
 */
const isClass = (object: any): boolean => {
    return isConstructor(object) && String(object).startsWith('class');
};

export default isClass;