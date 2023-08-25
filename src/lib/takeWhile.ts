/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

/**
 * Creates a new array from another one. Items from the original array
 * are taken if the provided predicate succeed. When the predicate fails,
 * no new items are taken
 *
 * @param {T[]} xs - The array to evaluate
 * @param {function(x:T): T[]} pred - The condition to apply to every element
 * @returns {T[]} - The filtered list
 */
export function takeWhile<T>(xs: T[], pred: (x: T) => boolean): T[] {
    return xs.length && pred(xs[0]) ? [xs[0], ...takeWhile(xs.slice(1), pred)] : [];
}

export default takeWhile;