/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

/**
 * Material Implication.
 * `p → q`
 * Also referred to as `if-then`.
 * An example of usage is the encoding of "sunny weather is a precondition of visiting the beach"
 * This is logically equivalent to: !p || q
 *
 * @example
 * implies(weather.isSunny, person.visitsBeach)
 *
 * @param {boolean} p - The antecedent
 * @param {boolean} q - The consequent
 * @returns {boolean} - The result
 */
export default function implies(p: boolean, q: boolean): boolean {
    return !p || q;
}