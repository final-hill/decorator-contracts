/**
 * Biconditional.
 * p ↔ q.
 * "P if and only if Q".
 * An example of usage is the encoding of "You can ride the train if and only if you have a ticket"
 * This is logically equivalent to: implies(p,q) && implies(q,p)
 *
 * @param p - The first boolean value (the antecedent).
 * @param q - The second boolean value (the consequent).
 * @returns - The result (biconditional) of p and q.
 *
 * @example
 * ```ts
 * import { iff } from '@final-hill/decorator-contracts';
 *
 * // You can ride the train if and only if you have a ticket
 * iff(person.hasTicket, person.ridesTrain)
 * ```
 */

export function iff(p: boolean, q: boolean): boolean {
    return (p && q) || (!p && !q);
}
