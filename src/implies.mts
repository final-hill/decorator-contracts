/**
 * Material Implication.
 * `p → q`
 * Also referred to as `if-then`.
 * An example of usage is the encoding of "sunny weather is a precondition of visiting the beach"
 * This is logically equivalent to: !p || q
 *
 * @param p - The first boolean value (the antecedent).
 * @param q - The second boolean value (the consequent).
 * @returns - The result (material implication) of p and q.
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
    return !p || q;
}
