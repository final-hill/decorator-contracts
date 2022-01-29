/*!
 * @license
 * Copyright (C) 2022 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

/**
 * Biconditional.
 * p ↔ q.
 * "P if and only if Q".
 * An example of usage is the encoding of "You can ride the train if and only if you have a ticket"
 * This is logically equivalent to: implies(p,q) && implies(q,p)
 *
 * @example
 * iff(person.hasTicket, person.ridesTrain)
 *
 * @param {boolean} p - The antecedent
 * @param {boolean} q - The consequent
 * @returns {boolean} - The result
 */
export default function iff(p: boolean, q: boolean): boolean {
    return (p && q) || (!p && !q);
}