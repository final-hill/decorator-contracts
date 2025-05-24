import { assert } from './assert.mjs';
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

    Contracted[checkedMode] = false; // Disable checked mode to avoid infinite recursion 

    const invariants = (Class[Symbol.metadata]?.['invariants'] ?? []) as InvariantPredicate<C>[];

    try {
        for (const inv of invariants)
            assert(
                inv(instance),
                `Invariant violated in class ${Class.name}: ${inv.toString()}`
            );
    } finally {
        Contracted[checkedMode] = true;
    }
}

export const invariant: InvariantDecorator = (predicate) => (OriginalClass, { kind, metadata }) => {
    assert(kind === 'class', '@invariant decorator can only be applied to classes');
    assert(OriginalClass.prototype instanceof Contracted, '@invariant decorator can only be applied to classes that extend Contracted');

    const existing = (metadata.invariants ?? []) as InvariantPredicate<typeof OriginalClass>[]
    metadata.invariants = [...existing, predicate];
};
