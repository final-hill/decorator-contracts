import type { Contracted } from './Contracted.mjs';
import type { RegisteredDemands } from './demands.mjs';
import type { RegisteredEnsures } from './ensures.mjs';
import type { RegisteredInvariant } from './invariant.mjs';
import type { RescueDeclaration } from './rescue.mjs';

/**
 * The contracts a class declares, as {@link getContractMetadata} reports them.
 *
 * This is the shape stored on `Contracted[Symbol.metadata]`, but read through the
 * accessor rather than the symbol so that a consumer receives copies and cannot
 * corrupt the contracts a class is checked against.
 *
 * Every list is already the **effective** set: a subclass's record contains its
 * own declarations and the inherited ones, because each decorator registers by
 * spreading the record it inherited. A consumer therefore never has to walk the
 * prototype chain itself.
 */
export interface ContractMetadata {
    /**
     * The class-level invariant arms.
     *
     * Unlike the feature contracts these are not keyed by feature: an invariant
     * describes the whole instance, so every arm applies to every call.
     */
    invariants: readonly RegisteredInvariant[];

    /** Precondition arms, keyed by feature name. */
    demands: Readonly<Record<PropertyKey, readonly RegisteredDemands[]>>;

    /** Postcondition arms, keyed by feature name. */
    ensures: Readonly<Record<PropertyKey, readonly RegisteredEnsures[]>>;

    /**
     * The rescue declaration, keyed by feature name.
     *
     * A map rather than a list because a feature has one handler: a second
     * `@rescue` on the same feature replaces the first.
     */
    rescue: Readonly<Record<PropertyKey, RescueDeclaration<Contracted>>>;
}

/**
 * The contracts that apply to one feature, in the order they are evaluated.
 *
 * Each list is the effective composition for the feature: inherited arms first,
 * then the class's own, and within one class in **reverse source order**, because
 * decorators evaluate bottom-up. That order is the one the contract runtime uses,
 * so an assertion built from this list describes what actually happens.
 */
export interface FeatureContracts {
    /** The feature's precondition arms, in evaluation order. */
    demands: readonly RegisteredDemands[];

    /** The feature's postcondition arms, in evaluation order. */
    ensures: readonly RegisteredEnsures[];

    /** The feature's rescue declaration, absent when it declares none. */
    rescue: RescueDeclaration<Contracted> | undefined;
}

const NO_ARMS: readonly never[] = Object.freeze([]);

const EMPTY: ContractMetadata = Object.freeze({
    invariants: NO_ARMS as readonly RegisteredInvariant[],
    demands: Object.freeze({}),
    ensures: Object.freeze({}),
    rescue: Object.freeze({}),
});

/**
 * Copies a registered arm so that its fields cannot be reassigned through the
 * accessor.
 *
 * The `arm` itself is **not** copied. It is a predicate or a schema the consumer
 * wrote, and its identity is what lets a consumer compare what they declared
 * against what the class reports, so the reference is preserved deliberately. Only
 * the record around it is copied, which is what stops a caller replacing the arm
 * the runtime evaluates.
 *
 * `options` is spread rather than shared for the same reason: it is a small
 * declaration record, and sharing it would leave `normalize` writable on the live
 * declaration even though the entry around it is a copy.
 */
const copyArm = <Entry extends { arm: unknown; options?: object }>(entry: Entry): Entry =>
    Object.freeze({
        ...entry,
        ...(entry.options ? { options: Object.freeze({ ...entry.options }) } : {}),
    }) as Entry;

/**
 * Copies a rescue declaration.
 *
 * `handler` keeps its identity for the reason `copyArm` gives for `arm`; the
 * record around it is copied so `maxRetries` cannot be rewritten after the class
 * is defined.
 */
const copyRescue = <Declaration extends { handler: unknown }>(declaration: Declaration): Declaration =>
    Object.freeze({ ...declaration }) as Declaration;

/**
 * Copies a record of rescue declarations.
 *
 * Each declaration is copied for the reason {@link copyRescue} gives, and the map
 * itself is copied so a feature cannot be given a handler the class never declared.
 */
const copyRescueMap = (
    source: Readonly<Record<PropertyKey, { handler: unknown }>> | undefined,
): Readonly<Record<PropertyKey, never>> => {
    if (!source) return Object.freeze({});

    const copy: Record<PropertyKey, unknown> = {};

    for (const key of Reflect.ownKeys(source))
        copy[key] = copyRescue(source[key]);

    return Object.freeze(copy) as Readonly<Record<PropertyKey, never>>;
};

/**
 * Copies a record of per-feature entries.
 *
 * Both the array and each entry are copied. Freezing the array alone is shallow:
 * it refuses `push`, and leaves `entries[0].arm = …` writing through to the record
 * the runtime consults. A copied entry refuses that assignment while the `arm` it
 * carries is still the consumer's own function.
 */
const copyEntries = <Entry extends { arm: unknown; options?: object }>(
    source: Readonly<Record<PropertyKey, readonly Entry[]>> | undefined,
): Readonly<Record<PropertyKey, readonly Entry[]>> => {
    if (!source) return Object.freeze({});

    const copy: Record<PropertyKey, readonly Entry[]> = {};

    for (const key of Reflect.ownKeys(source))
        copy[key] = Object.freeze((source[key] as readonly Entry[]).map(copyArm));

    return Object.freeze(copy);
};

/**
 * Reports the contracts declared on a class.
 *
 * Use this instead of reading `Contracted[Symbol.metadata]`. The symbol is a
 * supported read surface, but the record it holds is the one the runtime consults,
 * so a consumer who reaches it directly can edit the contracts their own class is
 * checked against. This returns copies.
 *
 * A class that declares nothing — including `Contracted` itself, and any subclass
 * that adds no decorator — has no record at all, and reports an empty one.
 *
 * @param Class - The class to inspect.
 * @returns The class's effective contracts. Stable across calls in the sense that
 *   the declared arms do not change after the class is defined.
 */
export function getContractMetadata<Class extends typeof Contracted>(
    Class: Class,
): ContractMetadata {
    const metadata = Class[Symbol.metadata] as ContractMetadata | undefined;

    if (!metadata) return EMPTY;

    return Object.freeze({
        invariants: Object.freeze((metadata.invariants ?? []).map(copyArm)),
        demands: copyEntries<RegisteredDemands>(metadata.demands),
        ensures: copyEntries<RegisteredEnsures>(metadata.ensures),
        rescue: copyRescueMap(metadata.rescue),
    });
}

/**
 * Reports the contracts that apply to one feature, in the order they are evaluated.
 *
 * This is what an architectural test usually wants: "every public verb declares a
 * precondition" is a question about one feature, and the answer depends on the
 * inherited arms as well as the class's own. Because each decorator registers by
 * spreading the record it inherited, the effective list is already assembled — this
 * reads it without walking the prototype chain.
 *
 * @param Class - The class to inspect.
 * @param feature - The feature's name.
 * @returns The feature's arms in evaluation order, or empty lists when it declares
 *   none. `rescue` is `undefined` when the feature declares no handler.
 */
export function getFeatureContracts<Class extends typeof Contracted>(
    Class: Class,
    feature: PropertyKey,
): FeatureContracts {
    const metadata = getContractMetadata(Class),
        rescue = metadata.rescue[feature];

    return Object.freeze({
        demands: (metadata.demands[feature] ?? NO_ARMS) as readonly RegisteredDemands[],
        ensures: (metadata.ensures[feature] ?? NO_ARMS) as readonly RegisteredEnsures[],
        // Already a copy: `getContractMetadata` copied the map. Re-copied here so
        // that the object a caller mutates is not the one they received from the
        // other accessor.
        rescue: rescue && copyRescue(rescue),
    });
}
