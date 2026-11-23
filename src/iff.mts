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
 * A non-boolean operand is coerced rather than rejected, because the parameters are
 * already `boolean`: a typed non-boolean operand does not compile. The coercion
 * therefore decides only what a value that reached the helper through `any` or
 * untyped JavaScript means, and there it is the ordinary JavaScript rule — a truthy
 * operand answers `true` rather than being named.
 *
 * A contract names a non-boolean *result*, but it cannot see inside the helper to
 * name an operand. State a contract through this helper only when both operands are
 * already booleans, or write the comparison directly instead.
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
