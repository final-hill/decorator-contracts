/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Constructor from '../typings/Constructor';

 /**
  * Returns the inheritance chain of the provided class including the class
  */
function getAncestry(Clazz: Constructor<any>): Constructor<any>[] {
    return Clazz == null ? [] :
        [Clazz].concat(getAncestry(Object.getPrototypeOf(Clazz)));
}

export default getAncestry;