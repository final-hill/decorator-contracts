import { violationFailure } from './assert.mjs';
import { contractsEnabled, Contracted } from "./Contracted.mjs";
import { classNameOf } from './name.mjs';
import { assertAwaitableFeature, assertFeatureContractTarget } from './decorator.mjs';
import {
    alreadyReported, failureLog, assertAwaitableArm, assertNormalizable, assertViolationFactory, describeArm,
    evaluateArm, evaluateArmAsync, inheritedArms, reportWeakeningArm, selectViolationFactory,
    type ArmFailures, type ArmOptions, type ArmSubjects,
} from './admissibility.mjs';
import type { StandardSchemaV1 } from './standard-schema.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * The fields a precondition predicate is called with.
 *
 * `self` is the instance and `args` is the invocation's argument list.
 *
 * `This` and `Args` are inferred from the member the decorator is applied to, so
 * a predicate that reads instance state needs no annotation:
 * `({ self, args }) => self._x > 0`. The inference comes from the decorator's
 * context type, which carries the class and the feature's signature; naming it
 * explicitly is only necessary where the runtime subject differs from that
 * signature.
 *
 * `self` is **not** `Readonly<This>`. `Readonly` maps over `keyof This`, which
 * covers only public members, so `Readonly<Cart>` has no `_balance` when
 * `_balance` is `protected` — the type would erase the fields contracts are
 * written against, and `protected` state is the documented convention. Purity is
 * enforced at runtime instead: every predicate receives a read-only view, so an
 * assignment throws rather than silently corrupting the instance the next
 * contract observes.
 */
export interface DemandsSubject<This, Args extends any[] = any[]> {
    readonly self: This;
    readonly args: Args;
}

/**
 * A precondition predicate.
 *
 * `args` is the argument list of the invocation, matching `EnsuresPredicate`,
 * so a predicate destructures it: `({ args: [x] }) => x > 0`.
 *
 * The type is generic over the argument tuple so the element types are inferred
 * from the predicate. Writing `({ args }) => args > 0` does not compile: `args`
 * is the array, not the first argument, and a predicate that compares against the
 * array passes only through coercion.
 *
 * It takes one object rather than a positional list, so a contract that supplies
 * a field the predicate does not read costs nothing where it is declared.
 */
export type DemandsPredicate<This extends Contracted, Args extends any[] = any[]> =
    (subject: DemandsSubject<This, Args>) => boolean;

/**
 * A precondition arm: a predicate, or a schema the argument tuple must satisfy.
 *
 * A predicate may answer with a promise, but only when the declaration sets
 * {@link ArmOptions.awaitPredicate} — the option is what makes the verdict
 * awaited rather than coerced, and the overload on `DemandsDecorator` refuses the
 * asynchronous form without it.
 *
 * A schema validates the **argument tuple**, which is the subject `@demands`
 * already describes, so a method with two parameters is written as
 * `z.tuple([A, B])`. Keeping one subject for both kinds of arm is what lets the
 * composition rule below be the same for both.
 *
 * The schema's `Input` is left unpinned (`unknown`) rather than constrained to
 * `any[]`, because every real provider declares a concrete input type and
 * `StandardSchemaV1` is invariant in it: pinning it here would reject a
 * `z.tuple([...])` whose input is `[number, number]`. The tuple shape is an
 * obligation on the declaration, checked at runtime by the schema itself.
 */
export type DemandsArm<This extends Contracted, Args extends any[] = any[]> =
    DemandsPredicate<This, Args>
    | ((subject: DemandsSubject<This, Args>) => boolean | Promise<boolean>)
    | StandardSchemaV1<unknown, any>;

/**
 * The `@demands` decorator.
 *
 * The two overloads are the opt-in. The first admits a synchronous verdict or a
 * schema, so an accidentally `async` predicate is a compile error there; the
 * second admits a promise and requires `awaitPredicate: true` to say so. Inference
 * of `self` and `args` comes from the decorated member either way, and an options
 * object built separately still matches the first overload.
 */
export type DemandsDecorator = {
    <This extends Contracted, Args extends any[]>(
        arm: DemandsPredicate<This, Args> | StandardSchemaV1<unknown, any>,
        options?: ArmOptions,
    ): (
        value: unknown,
        context: FeatureDecoratorContext<This, Args>
    ) => void;
    <This extends Contracted, Args extends any[]>(
        arm: DemandsArm<This, Args>,
        options: ArmOptions & { awaitPredicate: true },
    ): (
        value: unknown,
        context: FeatureDecoratorContext<This, Args>
    ) => void;
};

/** No arm is declared for a feature, so none is evaluated. */
const NO_ARMS: readonly RegisteredDemands[] = Object.freeze([]);

/** A registered precondition arm, with the options it was declared with. */
export interface RegisteredDemands {
    arm: DemandsArm<Contracted>;
    options?: ArmOptions;
}

export const demands: DemandsDecorator = (arm, options) => (feature, ctx) => {
    assertFeatureContractTarget('@demands', feature, ctx);
    assertAwaitableFeature('@demands', feature, ctx, options);
    assertAwaitableArm(arm, '@demands', options);
    assertNormalizable(arm, '@demands', options);
    assertViolationFactory('@demands', options);

    // A subclass arm reads as a restriction and is not one: OR-composition keeps
    // every inherited arm, so satisfying any of them still permits the call. The
    // diagnostic names that where the arm is written, which is the only point the
    // author is looking at it.
    //
    // Reported once per feature: a class may carry several arms on one method, and
    // each decorator runs independently, so an unconditional report would print the
    // same message for each of them.
    //
    // The feature is `ctx.name`; the decorator's `value` parameter is the element,
    // so using it here would look the arms up under a function's source text. A
    // member decorator's context carries no class name — the class is not in scope
    // — so the label names the feature alone rather than inventing a class.
    if (!alreadyReported(ctx.metadata, ctx.name))
        reportWeakeningArm(
            '@demands',
            String(ctx.name),
            inheritedArms(ctx.metadata, ctx.name),
            options,
        );

    // The cast is the protocol's, not this contract's: `ctx.metadata` is
    // `DecoratorMetadataObject`, an open `Record<PropertyKey, unknown>`, so the
    // key this decorator writes has no static type until it is asserted. The
    // record's shape is asserted once here and read back through
    // `Contracted[Symbol.metadata]`, which is typed.
    const ds = [
        ...(ctx.metadata as any)?.demands?.[ctx.name] ?? [],
        { arm, options }
    ]

    ctx.metadata.demands = {
        ...(ctx.metadata?.demands ?? {}),
        [ctx.name]: ds
    };
}

/** What a precondition arm observes: the instance and the invocation's arguments. */
const demandsSubjects = (instance: Contracted, args: any[]): ArmSubjects => ({
    predicate: () => ({ self: instance, args }),
    schema: () => args,
});

/**
 * Raises the failure for a precondition no arm satisfied.
 *
 * All arms are reported, because OR-composition means any of them could have
 * permitted the call. A declared factory decides the error; failing that, a thrown
 * value is raised in place of the `AssertionError`, so a typed error survives.
 */
function raiseDemandsFailure(
    ds: readonly RegisteredDemands[],
    className: string,
    propertyKey: PropertyKey,
    failures: ArmFailures,
): never {
    throw violationFailure(
        '@demands',
        className,
        String(propertyKey),
        ds.map(entry => entry.arm),
        failures,
        'A precondition was not satisfied, so the feature was not entered.',
        describeArm,
        selectViolationFactory(ds),
    );
}

/**
 * Evaluates the precondition for an invocation.
 *
 * The arms are OR-composed, which is the contravariance rule: a subtype may
 * weaken a precondition, so satisfying any inherited arm is enough. A schema arm
 * composes exactly like a predicate arm.
 *
 * When an arm asks for normalization, the value it produced replaces the
 * arguments, and because OR-composition short-circuits, the **first passing arm**
 * decides what that value is. That is deterministic and matches evaluation order.
 *
 * @param enabled - Whether the contracts are evaluated for this class. The lifecycle
 *   has already resolved the switch, so it passes its verdict rather than making this
 *   function walk the class chain a second time; a caller that reaches this function
 *   on its own omits it and the switch is resolved here.
 * @returns The arguments to use, which are the originals unless an arm
 *   normalized them.
 */
export function assertDemands(
    instance: Contracted,
    propertyKey: PropertyKey,
    args: any[],
    enabled: boolean = contractsEnabled(instance.constructor),
): any[] {
    if (!enabled) return args;

    const Class = instance.constructor as typeof Contracted,
        ds = Class[Symbol.metadata]?.demands?.[propertyKey] ?? NO_ARMS;

    if (ds.length === 0) return args;

    const label = () => `${classNameOf(Class)}.${String(propertyKey)}`,
        failures = failureLog();

    for (let index = 0; index < ds.length; index++) {
        const { arm, options } = ds[index],
            result = evaluateArm(arm, demandsSubjects(instance, args), '@demands', label, index, options);

        // A later arm may still permit the call, so a rejected arm is recorded
        // rather than returned from. Propagating a throw here would make a legal
        // weakening arm unreachable.
        if (!result.ok) {
            failures.record(index, result);

            continue;
        }

        // Any satisfied arm fulfils the obligation.
        return result.value === undefined ? args : result.value as any[];
    }

    raiseDemandsFailure(ds, classNameOf(Class), propertyKey, failures.entries!);
}

/**
 * Whether any registered arm declared `awaitPredicate`.
 *
 * The asynchronous lifecycle asks this before choosing the awaited composition, so
 * a feature whose arms are all synchronous pays nothing for the capability: the
 * awaited form returns a promise from every call, which is one extra microtask the
 * caller would wait on for a verdict that was already decided synchronously.
 *
 * @param instance - The instance whose class holds the record.
 * @param propertyKey - The feature being invoked.
 * @internal
 * Exported only so the lifecycle in `Contracted.mts` can import it; `index.mts`
 * does not re-export it.
 */
export function demandsAwaitable(instance: Contracted, propertyKey: PropertyKey): boolean {
    const Class = instance.constructor as typeof Contracted;

    return (Class[Symbol.metadata]?.demands?.[propertyKey] ?? NO_ARMS).some(entry => entry.options?.awaitPredicate);
}

/**
 * Evaluates the precondition for an invocation whose arms may answer with a promise.
 *
 * OR-composition decides the arms here too: a subtype may weaken a precondition,
 * so satisfying any arm is enough. Only the settlement differs, and it is stated
 * separately from {@link assertDemands} because the two boundaries differ: this
 * one hands back a promise, and a synchronous feature's precondition must be
 * decided before its body starts rather than in a microtask afterwards.
 *
 * A rejected predicate is a failed arm, exactly as a throwing one is, so a sibling
 * arm may still permit the call and the rejection is raised only if every arm
 * fails.
 */
export async function assertDemandsAsync(
    instance: Contracted,
    propertyKey: PropertyKey,
    args: any[],
    enabled: boolean = contractsEnabled(instance.constructor),
): Promise<any[]> {
    if (!enabled) return args;

    const Class = instance.constructor as typeof Contracted,
        ds = Class[Symbol.metadata]?.demands?.[propertyKey] ?? NO_ARMS;

    if (ds.length === 0) return args;

    const label = () => `${classNameOf(Class)}.${String(propertyKey)}`,
        failures = failureLog();

    for (let index = 0; index < ds.length; index++) {
        const { arm, options } = ds[index],
            result = await evaluateArmAsync(arm, demandsSubjects(instance, args), '@demands', label, index, options);

        if (!result.ok) {
            failures.record(index, result);

            continue;
        }

        return result.value === undefined ? args : result.value as any[];
    }

    raiseDemandsFailure(ds, classNameOf(Class), propertyKey, failures.entries!);
}
