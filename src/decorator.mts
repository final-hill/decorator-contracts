import { assert } from './assert.mjs';
import { Contracted } from './Contracted.mjs';
import { featureKindOf } from './feature-kind.mjs';
import type { ArmOptions } from './admissibility.mjs';

/**
 * Rejects a call that did not receive a standard decorator context.
 *
 * Every standard context carries a string `kind`, and the second argument of a
 * pre-standard invocation never does: for a member it is the property key, and a
 * class decorator is called with the class alone, so there is no second argument
 * at all. Testing that one field is therefore enough to tell the protocols apart,
 * and it is deliberately the only test — a guard that demanded more of the
 * context would reject a real one as the decorator-context proposal gains fields.
 *
 * Without the check every later assertion describes the wrong problem: a member
 * decorator reports that the method it was applied to is not a method, and
 * `@invariant` destructures `undefined`.
 *
 * The check runs before any other, in every decorator, because it is the one
 * failure that makes the rest of the diagnostics meaningless.
 *
 * The assertion signature carries the narrowing, so callers get a typed context
 * from a value they could not otherwise inspect. It narrows to the union rather
 * than to a member context, because a class decorator is checked by the same
 * guard.
 */
export function assertDecoratorContext(
    contract: string,
    context: unknown,
): asserts context is DecoratorContext {
    const kind = (context as { kind?: unknown } | undefined)?.kind;

    assert(
        typeof kind === 'string',
        `${contract} was invoked without a standard decorator context, so it received no 'kind'. `
        + "This happens when the compiler emits the pre-standard protocol, which `experimentalDecorators` selects. "
        + 'This library requires the TC39 protocol, so disable `experimentalDecorators` (and `emitDecoratorMetadata`), '
        + 'and make sure the build lowers decorator syntax rather than passing it through.',
    );
}

/**
 * The gate every feature contract decorator shares.
 *
 * `@demands`, `@ensures`, and `@rescue` apply to exactly the same kind of member:
 * an instance feature of a `Contracted` subclass, whose name is not `_`-prefixed.
 * The rule lives here rather than in each decorator so that a constraint added to
 * one applies to all three, instead of being easy to miss in the others.
 *
 * The name of the contract is passed in so the messages stay specific.
 *
 * `context` is `unknown` because the protocol is diagnosed here rather than by
 * the caller; the guard narrows it to a standard context.
 */
export function assertFeatureContractTarget(contract: string, feature: unknown, context: unknown): void {
    assertDecoratorContext(contract, context);

    assert(
        context.kind === 'method' || context.kind === 'getter' || context.kind === 'setter',
        `${contract} decorator can only be applied to methods, getters, or setters`,
    );

    assert(context.static === false, `${contract} decorator cannot be applied to static features`);
    assert(context.private === false, `${contract} decorator cannot be applied to private features`);
    assert(!String(context.name).startsWith('_'), `${contract} decorator cannot be applied to private/protected features`);

    // Registration happens at decoration time rather than in `addInitializer`,
    // which runs once per instance: doing it there appended the same predicate on
    // every instantiation, which was unbounded metadata growth and a linearly
    // growing predicate list to evaluate on each call.
    context.addInitializer(function () {
        assert(this instanceof Contracted, `${contract} decorator can only be applied to classes that extend Contracted`);
    });
}

/**
 * Rejects `awaitPredicate` on a feature whose boundary cannot await it.
 *
 * The option moves a precondition's verdict to a microtask, which is only sound
 * where the feature's own result is already behind a promise: an `async` body is
 * awaited before its exit checks run, so awaiting its entry checks moves nothing
 * the caller could observe. The other three boundaries cannot absorb the wait.
 *
 * - A getter or setter is an accessor. Its caller reads or assigns synchronously,
 *   so there is no promise to attach a pending verdict to.
 * - A generator hands the caller an iterator and runs nothing until it is
 *   resumed. Its contracts bracket a *step*, and awaiting one would make every
 *   `next()` asynchronous — a different protocol, not a slower check.
 * - An async generator has the same per-step boundary.
 *
 * Each case is refused where it is written, with the reason, rather than accepted
 * and then ignored by a lifecycle that cannot honour it. The element is the
 * decorated member itself, so its kind is readable here; a class body that
 * overrides an `async` feature with a synchronous one is caught separately, at the
 * boundary, because the inherited declaration is not in scope at this point.
 *
 * @param contract - The contract name, for the message.
 * @param element - The decorated member, whose kind decides.
 * @param context - The member's decorator context.
 * @param options - The declaration's options.
 */
export function assertAwaitableFeature(
    contract: string,
    element: unknown,
    context: { kind: string },
    options: ArmOptions | undefined,
): void {
    if (!options?.awaitPredicate) return;

    if (context.kind !== 'method')
        throw new TypeError(
            `${contract} cannot declare awaitPredicate on ${context.kind === 'getter' ? 'a getter' : 'a setter'}: `
            + 'an accessor is read or assigned synchronously, so there is no promise a pending verdict could join.',
        );

    const kind = featureKindOf(element as (...args: any[]) => unknown);

    if (kind === 'async') return;

    const reason = kind === 'generator' || kind === 'async-generator'
        ? 'a generator has one contract boundary per step, and awaiting a step would make every `next()` asynchronous rather than merely slower'
        : 'a synchronous feature has evaluated its contracts by the time the verdict could settle';

    throw new TypeError(
        `${contract} cannot declare awaitPredicate on this feature: ${reason}. `
        + 'The option is available on an `async` method only.',
    );
}
