/*!
 * @license
 * Copyright (C) 2020 Michael L Haufe
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {Constructor} from '../typings/Constructor';

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