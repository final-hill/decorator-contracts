/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

 /**
  * Determines if the provided object is constructable
  */
const isConstructor = (object: any) => {
    try {
        return Boolean(new (new Proxy(object, {
            construct() { return this; }
        }))());
    } catch(e) {
        return false;
    }
};

export default isConstructor;