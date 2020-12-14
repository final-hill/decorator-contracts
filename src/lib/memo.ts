/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

 /**
 * Memoizes a single parameter function
 * @param {function(arg: any): any} fn The function to memoize
 * @returns {function(arg: any): any} The memoized function
 */
function memo<F extends (arg: any) => any>(fn: F): F {
    const wm = new WeakMap<Constructor<any>,Constructor<any>[]>();

    return (arg =>
        !(arg instanceof Object) ? fn(arg) :
        wm.has(arg) ? wm.get(arg) :
        wm.set(arg,fn(arg)).get(arg)
    ) as F;
}

export default memo;