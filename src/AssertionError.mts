import type { StandardSchemaV1 } from './standard-schema.mjs';

/**
 * The contract kinds that can raise an {@link AssertionError}.
 */
export type ContractKind = '@invariant' | '@demands' | '@ensures';

/**
 * Structured description of a failed contract.
 *
 * Attached to {@link AssertionError} so that callers — including integration
 * layers such as a schema adapter — can react to a specific violation without
 * parsing the message.
 */
export interface ContractViolation {
    /** Which contract failed. */
    contract: ContractKind;
    /** The class the contract belongs to. */
    className: string;
    /** The feature the contract belongs to, absent for `@invariant`. */
    feature?: string;
    /**
     * The indices, within the contract's composition list, that failed.
     *
     * `@demands` is OR-composed, so a failure lists every arm; `@ensures` and
     * `@invariant` are AND-composed, so a failure lists the one that broke.
     */
    failedIndices: number[];
    /** The source text of the failing arms, aligned with `failedIndices`. */
    predicates: string[];
    /**
     * The `issues` reported by failing schema arms, in the order they were
     * raised. Absent when the failure came only from predicate arms, so a caller
     * can distinguish "a schema rejected this" from "a predicate returned
     * false".
     */
    issues?: ReadonlyArray<StandardSchemaV1.Issue>;
}

/**
 * An `AssertionError` represents a failed assertion with an associated message.
 *
 * When the failure came from a contract, {@link AssertionError.violation}
 * describes it structurally.
 */
export class AssertionError extends Error {
    /**
     * Set explicitly rather than relying on the class name.
     *
     * Bundlers rename classes, so the published build would otherwise expose a
     * mangled name such as `t` to consumers.
     */
    override name = 'AssertionError';

    /** Structured description of the failure, when it came from a contract. */
    readonly violation?: ContractViolation;

    constructor(message?: string, violation?: ContractViolation) {
        super(message);
        this.violation = violation;
    }
}
