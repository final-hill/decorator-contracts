import { assert, assertContractResult, describeViolation } from './assert.mjs';
import { AssertionError } from './AssertionError.mjs';
import { checkedMode, Contracted } from './Contracted.mjs';

export type InvariantPredicate<Class extends typeof Contracted> = (self: InstanceType<Class>) => boolean;

export type InvariantDecorator = <Class extends typeof Contracted>(
    predicate: InvariantPredicate<Class>
) => (
    value: Class,
    context: ClassDecoratorContext<Class>
) => Class | void;

export function assertInvariants<C extends typeof Contracted, T extends InstanceType<C>>(Class: C, instance: T) {
    if (!Contracted[checkedMode]) return;

    const invariants = (Class[Symbol.metadata]?.['invariants'] ?? []) as InvariantPredicate<C>[],
        failed: number[] = [];

    for (const [index, inv] of invariants.entries())
        if (!assertContractResult(inv(instance), '@invariant', Class.name, index))
            failed.push(index);

    if (failed.length === 0) return;

    const { message, violation } = describeViolation(
        '@invariant',
        Class.name,
        undefined,
        invariants,
        failed,
        'The instance left the invariant unsatisfied.',
    );

    throw new AssertionError(message, violation);
}

export const invariant: InvariantDecorator = (predicate) => (OriginalClass, { kind, metadata }) => {
    assert(kind === 'class', '@invariant decorator can only be applied to classes');
    assert(OriginalClass.prototype instanceof Contracted, '@invariant decorator can only be applied to classes that extend Contracted');

    const existing = (metadata.invariants ?? []) as InvariantPredicate<typeof OriginalClass>[]
    metadata.invariants = [...existing, predicate];
};
