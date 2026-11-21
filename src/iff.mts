/**
 * Biconditional.
 * p ↔ q.
 * "P if and only if Q".
 * An example of usage is the encoding of "You can ride the train if and only if you have a ticket"
 * This is logically equivalent to: implies(p,q) && implies(q,p)
 *
 * @param p - The first boolean value (the antecedent).
 * @param q - The second boolean value (the consequent).
 * @returns - The result (biconditional) of p and q, always a `boolean`.
 *
 * A non-boolean operand is coerced rather than rejected, because this is a
 * general-purpose logical helper. Inside a contract the coercion is redundant:
 * `@demands` and the other contracts already require a literal `true` or `false`
 * and will report a non-boolean result by name.
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
    // Coerced rather than returned directly. `(p && q) || (!p && !q)` is
    // logically correct but returns an *operand* rather than a boolean, so a
    // truthy non-boolean operand (`iff(true, someObject)`) would leak through a
    // signature that promises `boolean`. The leak only appears when the
    // non-boolean sits on the returned side of the short-circuit, which is why it
    // is easy to miss in testing.
    return Boolean((p && q) || (!p && !q));
}
