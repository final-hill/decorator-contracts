/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import memo from './memo';

 /**
 * Returns the inheritance chain of the provided class including the class
 *
 * @param {Constructor<any>} Class - The class to evaluate
 * @returns {Constructor<any>[]} - The array of ancestors
 */
const getAncestry = memo((Class: Constructor<any>): Constructor<any>[] =>
    Class == null ? [] : [Class].concat(getAncestry(Object.getPrototypeOf(Class)))
);


export default getAncestry;