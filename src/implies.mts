/**
 * Material Implication.
 * `p → q`
 * Also referred to as `if-then`.
 * An example of usage is the encoding of "sunny weather is a precondition of visiting the beach"
 * This is logically equivalent to: !p || q
 *
 * @param p - The first boolean value (the antecedent).
 * @param q - The second boolean value (the consequent).
 * @returns - The result (material implication) of p and q, always a `boolean`.
 *
 * A non-boolean consequent is coerced rather than rejected, because the parameters
 * are already `boolean`: a typed non-boolean operand does not compile. The coercion
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
 * import { implies } from '@final-hill/decorator-contracts';
 *
 * // Sunny weather is a precondition of visiting the beach
 * implies(weather.isSunny, person.visitsBeach)
 * ```
 */

export function implies(p: boolean, q: boolean): boolean {
    // Coerced for the same reason as `iff`: `!p || q` returns the operand `q`
    // when `p` is falsy, so a truthy non-boolean would escape a `boolean` return.
    return !p || Boolean(q);
}
