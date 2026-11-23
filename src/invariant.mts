import { assert, violationFailure } from './assert.mjs';
import { contractsEnabled, Contracted } from './Contracted.mjs';
import { classNameOf } from './name.mjs';
import { assertDecoratorContext } from './decorator.mjs';
import { armFailures, assertNotNormalizable, assertNotViolationFactory, assertNotWeakenable, describeArm, evaluateArm, recordFailure, type ArmOptions } from './admissibility.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';

/**
 * The fields an invariant predicate is called with.
 *
 * An invariant describes the whole instance, so `self` is the only field. See
 * `DemandsSubject` for why it is not `Readonly<This>`, which would hide the
 * `protected` state an invariant is written against.
 *
 * A predicate rarely needs to name this type. The decorator receives the class,
 * so `This` is inferred and `@invariant(({ self }) => ...)` reads instance state
 * without an annotation. It is exported for code that builds an arm separately
 * from the decorator that registers it.
 */
export interface InvariantSubject<This> {
    readonly self: This;
}

/**
 * An invariant predicate: a property the instance always satisfies.
 *
 * It takes one object rather than a positional list, so every contract in the
 * library presents the same shape to the predicate it calls.
 */
export type InvariantPredicate<Class extends typeof Contracted> =
    (subject: InvariantSubject<InstanceType<Class>>) => boolean;

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
    if (!contractsEnabled(Class)) return;

    const registered = (Class[Symbol.metadata]?.['invariants'] ?? []) as unknown as RegisteredInvariant[];

    // A class with no invariant arms is the common case, and this runs on entry and
    // exit of every feature. The name is only needed to label an arm, so it is
    // resolved after the loop has decided one failed rather than on every call: a
    // declaration may be an accessor, and reading it twice per invocation to name a
    // failure that did not happen is cost the caller pays for nothing.
    if (registered.length === 0) return;

    const className = classNameOf(Class),
        failures = armFailures();

    // AND-composed: every arm must hold for the instance to be valid. Invariants
    // are covariant, so a subtype may strengthen the obligation but never weaken
    // it, which is why one failing arm is enough to reject.
    for (const [index, entry] of registered.entries()) {
        const result = evaluateArm(
            entry.arm,
            { predicate: () => ({ self: instance }), schema: () => instance },
            '@invariant',
            className,
            index,
            entry.options,
        );

        if (result.ok) continue;

        // Every arm is evaluated even after one rejects, because a report naming
        // only the first broken invariant hides the others the instance violates
        // at the same moment.
        recordFailure(failures, index, result);
    }

    if (failures.failed.length === 0) return;

    throw violationFailure(
        '@invariant',
        className,
        undefined,
        registered.map(entry => entry.arm),
        failures,
        'The instance left the invariant unsatisfied.',
        describeArm,
    );
}

export const invariant: InvariantDecorator = (arm, options) => (OriginalClass, context) => {
    assertDecoratorContext('@invariant', context);
    assertNotNormalizable('@invariant', options);
    assertNotViolationFactory('@invariant', options);
    assertNotWeakenable('@invariant', options);

    const { metadata } = context;

    assert(context.kind === 'class', '@invariant decorator can only be applied to classes');
    assert(OriginalClass.prototype instanceof Contracted, '@invariant decorator can only be applied to classes that extend Contracted');

    const existing = (metadata.invariants ?? []) as unknown as RegisteredInvariant[];

    metadata.invariants = [...existing, { arm, options }];
};
