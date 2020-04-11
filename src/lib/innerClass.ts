/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import { DecoratedConstructor, IS_PROXY, INNER_CLASS } from '../typings/DecoratedConstructor';
import type {Constructor} from '../typings/Constructor';

/**
 * If the provided constructor is a ClazzProxy return the inner class
 * else just return the provided object
 *
 * @param {DecoratedConstructor | Constructor<any>} Cons - The constructor to evaluate
 * @returns {Constructor<any>} The decorated class
 */
function innerClass(Cons: DecoratedConstructor | Constructor<any>): Constructor<any> {
    if(Object.getOwnPropertySymbols(Cons).includes(IS_PROXY)) {
        return (Cons as DecoratedConstructor)[INNER_CLASS]!;
    } else {
        return Cons;
    }
}

export default innerClass;