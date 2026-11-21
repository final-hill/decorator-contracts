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
 * A non-boolean consequent is coerced rather than rejected, for the same reason
 * as {@link iff}.
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
