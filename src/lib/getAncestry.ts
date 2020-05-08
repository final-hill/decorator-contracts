/*!
 * @license
 * Copyright (C) 2021 Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import type {Constructor} from '../typings/Constructor';

/**
 * Returns the inheritance chain of the provided class including the class
 *
 * @param {Constructor<any>} Clazz - The class to evaluate
 * @returns {Constructor<any>[]} - The array of ancestors
 */
function getAncestry(Clazz: Constructor<any>): Constructor<any>[] {
    return Clazz == null ? [] :
        [Clazz].concat(getAncestry(Object.getPrototypeOf(Clazz)));
}

export default getAncestry;