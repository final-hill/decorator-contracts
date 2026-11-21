import { assert, violationError } from './assert.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';
import { describeArm, evaluateArm, type ArmOptions } from './admissibility.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';

/**
 * An invariant predicate: a property the instance always satisfies.
 */
export type InvariantPredicate<Class extends typeof Contracted> = (self: InstanceType<Class>) => boolean;

/**
 * An invariant arm: a predicate, or a schema the instance must satisfy.
 *
 * A schema in this position validates the **instance**, which is the subject
 * `@invariant` already describes.
 */
export type InvariantArm<Class extends typeof Contracted> =
    InvariantPredicate<Class> | StandardSchemaV1<unknown, any>;

export type InvariantDecorator = <Class extends typeof Contracted>(
    arm: InvariantArm<Class>,
    options?: ArmOptions,
) => (
    value: Class,
    context: ClassDecoratorContext<Class>
) => Class | void;

/**
 * A registered invariant arm.
 *
 * The options travel with the arm because `normalize` is a property of the
 * declaration rather than of an individual evaluation.
 */
export interface RegisteredInvariant {
    arm: InvariantArm<typeof Contracted>;
    options?: ArmOptions;
}

export function assertInvariants<C extends typeof Contracted, T extends InstanceType<C>>(Class: C, instance: T) {
    if (!Contracted[checkedMode]) return;

    const registered = (Class[Symbol.metadata]?.['invariants'] ?? []) as unknown as RegisteredInvariant[],
        failed: number[] = [],
        issues: StandardSchemaV1.Issue[] = [];

    // AND-composed: every arm must hold for the instance to be valid. Invariants
    // are covariant, so a subtype may strengthen the obligation but never weaken
    // it, which is why one failing arm is enough to reject.
    for (const [index, entry] of registered.entries()) {
        const result = evaluateArm(
            entry.arm,
            { predicate: () => [instance], schema: () => instance },
            '@invariant',
            Class.name,
            index,
            entry.options,
        );

        if (result.ok) continue;

        failed.push(index);

        if (result.issues) issues.push(...result.issues);
    }

    if (failed.length === 0) return;

    throw violationError(
        '@invariant',
        Class.name,
        undefined,
        registered.map(entry => entry.arm),
        failed,
        'The instance left the invariant unsatisfied.',
        issues,
        describeArm,
    );
}

export const invariant: InvariantDecorator = (arm, options) => (OriginalClass, { kind, metadata }) => {
    assert(kind === 'class', '@invariant decorator can only be applied to classes');
    assert(OriginalClass.prototype instanceof Contracted, '@invariant decorator can only be applied to classes that extend Contracted');

    const existing = (metadata.invariants ?? []) as unknown as RegisteredInvariant[];

    metadata.invariants = [...existing, { arm, options }];
};
