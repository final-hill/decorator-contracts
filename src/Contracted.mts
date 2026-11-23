import { AssertionError } from './AssertionError.mjs';
import { installInspect } from './inspect.mjs';
import { assertInvariants } from './invariant.mjs';
import { assertDemands, assertDemandsAsync, demandsAwaitable } from './demands.mjs';
import { assertEnsures, assertEnsuresAsync, ensuresAwaitable, EnsuresPredicate } from './ensures.mjs';
import { classNameOf } from './name.mjs';
import { featureKindOf, type FeatureKind } from './feature-kind.mjs';
import { applyRescueHandler as applyRescueHandler, getRescueDeclaration } from './rescue.mjs';
import type { ContractMetadata } from './metadata.mjs';

// Symbol to store checked mode state
export const checkedMode = Symbol.for('Contracted.checkedMode');

/**
 * The switch for encapsulation, independent of {@link checkedMode}.
 *
 * Encapsulation is the `set`, `defineProperty`, and `deleteProperty` traps: the
 * rule that an external caller may not mutate state without a postcondition to
 * catch it. Contracts are whether `@invariant`, `@demands`, `@ensures`, and
 * `@rescue` are evaluated at all.
 *
 * They are separate because they answer different questions. A test double or a
 * plain data holder wants the contract checks off while still refusing an
 * assignment to a field it never declared. A class that is deliberately
 * configured with its state exposed wants the reverse. A single switch cannot
 * express either, because it would have to answer both at once.
 *
 * A class opts out by assigning a static, exactly as with {@link checkedMode}, and
 * the nearest declaration on the class chain wins.
 */
export const encapsulationMode = Symbol.for('Contracted.encapsulationMode');

/** The switches in force for one class. */
interface Enforcement {
    /** Whether `@invariant`, `@demands`, `@ensures`, and `@rescue` are evaluated. */
    readonly contracts: boolean;
    /** Whether an external write, definition, or deletion is trapped. */
    readonly encapsulation: boolean;
}

/**
 * Reads one enforcement switch from the class chain.
 *
 * The nearest **own** declaration wins, which is why the walk tests ownership
 * rather than the value: `Class[symbol]` would read an inherited declaration but
 * cannot tell it apart from one this class made, and a class that declares
 * nothing must fall through to the default rather than inherit from a sibling.
 *
 * The walk stops at `Function.prototype`, which is where a constructor chain ends.
 * A key that is not a constructor — a plain object, `undefined` — yields the
 * default rather than throwing, so a caller that has no `constructor` to offer
 * still gets a defined answer.
 *
 * Not memoised: the switch is assignable at runtime, and a cache would have to be
 * invalidated on every write, which is what a cache of a mutable switch gets
 * wrong.
 */
const switchOn = (Class: unknown, symbol: symbol): boolean => {
    for (let C: any = Class; typeof C === 'function' && C !== Function.prototype; C = Object.getPrototypeOf(C))
        if (Object.hasOwn(C, symbol)) return Boolean(C[symbol]);

    return true;
};

/**
 * The enforcement switches in force for one class.
 *
 * Both default to on, and each is resolved independently so a class may want one
 * without the other.
 *
 * @param Class - The constructor to resolve for, usually `instance.constructor`.
 */
const enforcementFor = (Class: unknown): Enforcement => ({
    contracts: switchOn(Class, checkedMode),
    encapsulation: switchOn(Class, encapsulationMode),
});

/**
 * Whether the contracts of `Class` are evaluated.
 *
 * @internal
 * Exported only because the four contract modules live in their own files and
 * import it. It takes a constructor rather than an instance because the caller
 * often has one without the other, and it is not part of the published surface.
 */
export const contractsEnabled = (Class: unknown): boolean => enforcementFor(Class).contracts;

/**
 * Whether `prop` names one of the enforcement switches.
 *
 * Set through the class, never through an instance. An instance write would land
 * on the raw target where no trap could refuse it, and a switch a caller can set
 * is a guarantee a caller can remove.
 */
const isSwitch = (prop: PropertyKey): boolean => prop === checkedMode || prop === encapsulationMode;

/**
 * Type of value that `cloneState` copies rather than shares.
 *
 * The list is deliberately closed: arrays, dates, maps, sets, and plain objects
 * are cloned because they are the containers contracts routinely compare. Every
 * other object — class instances, functions, regular expressions, buffers — is
 * shared by reference. See the `@ensures` documentation for the rationale.
 */
const isPlainObject = (value: object): boolean => {
    const proto = Object.getPrototypeOf(value);

    return proto === Object.prototype || proto === null;
}

/**
 * Copies a value for use in an `old` snapshot.
 *
 * Plain data containers are cloned recursively so that mutations performed by
 * the feature body are not visible through `old`. Anything else is returned by
 * reference, which preserves identity and avoids attempting to clone values that
 * cannot be cloned meaningfully (functions, class instances, buffers).
 *
 * Own property descriptors are copied rather than values, so accessors are not
 * invoked while snapshotting. An accessor on `old` therefore reads the
 * historical state through `this`, which is what a postcondition expects.
 */
const cloneState = (value: any, seen: WeakMap<object, any>): any => {
    if (typeof value !== 'object' || value === null) return value;

    const already = seen.get(value);
    if (already !== undefined) return already;

    if (value instanceof Date) return new Date(value.getTime());

    if (Array.isArray(value)) {
        const copy: any[] = [];
        seen.set(value, copy);
        for (const item of value) copy.push(cloneState(item, seen));

        return copy;
    }

    if (value instanceof Map) {
        const copy = new Map<any, any>();
        seen.set(value, copy);
        for (const [k, v] of value) copy.set(cloneState(k, seen), cloneState(v, seen));

        return copy;
    }

    if (value instanceof Set) {
        const copy = new Set<any>();
        seen.set(value, copy);
        for (const item of value) copy.add(cloneState(item, seen));

        return copy;
    }

    if (!isPlainObject(value)) return value;

    const copy = Object.create(Object.getPrototypeOf(value));
    seen.set(value, copy);

    for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
        Reflect.defineProperty(copy, key, 'value' in descriptor
            ? { ...descriptor, value: cloneState(descriptor.value, seen) }
            : descriptor);
    }

    return copy;
}

/**
 * Builds the `old` instance passed to `@ensures`.
 *
 * The result inherits from `target`, so prototype members (including getters and
 * methods) remain reachable, while own state is a copy taken at this moment.
 * Getters defined on the prototype therefore read the historical own state
 * through `this`.
 */
const populateOld = (target: Contracted) => {
    if (!contractsEnabled(target.constructor)) return;

    const old = Object.create(target),
        seen = new WeakMap<object, any>();

    for (const key of Reflect.ownKeys(target)) {
        const descriptor = Object.getOwnPropertyDescriptor(target, key)!;
        Reflect.defineProperty(old, key, 'value' in descriptor
            ? { ...descriptor, value: cloneState(descriptor.value, seen) }
            : descriptor);
    }

    return old;
}

/**
 * Caches the contract wrapper per instance and feature, so `f.m === f.m`.
 *
 * The cache is keyed on the property and resolves the descriptor once, so it
 * assumes the function a property resolves to does not change while the instance
 * lives. Replacing the member on the class prototype is outside both traps and
 * leaves the cache bound to the function it first saw; the prototype an instance
 * resolves through is therefore part of what the cache depends on, which is why the
 * `setPrototypeOf` trap refuses to change it while encapsulation is on.
 */
const wrapperCache = new WeakMap<object, Map<PropertyKey, (...args: any[]) => any>>();

// Utility to walk up the prototype chain to find a property descriptor
function getPropertyDescriptor(obj: object, prop: PropertyKey): PropertyDescriptor | undefined {
    let proto = obj;
    while (proto && proto !== Object.prototype) {
        const desc = Object.getOwnPropertyDescriptor(proto, prop);
        if (desc) return desc;
        proto = Object.getPrototypeOf(proto);
    }
    return undefined;
}

/**
 * The kind of public feature whose boundary is being evaluated.
 *
 * `@ensures` and `@rescue` treat a getter differently from every other feature,
 * and the rule was written out four times: once in the synchronous lifecycle and
 * once in the asynchronous one, for each contract. Naming it here keeps the two
 * lifecycles from drifting apart on the one thing they must agree about.
 */
type DescriptorType = 'get' | 'set' | 'func' | 'delete';

/**
 * The arguments an `@ensures` predicate observes.
 *
 * A getter delivers its result as the value the caller receives, so that is what
 * its postcondition describes. Every other feature is described by the arguments
 * it was invoked with.
 */
const ensuresArgs = (descriptorType: DescriptorType, result: unknown, args: any[]): any[] =>
    descriptorType === 'get' ? [result] : args;

/**
 * The arguments an `@rescue` retry restarts the lifecycle with.
 *
 * A getter has no arguments to replay, so a retry runs it from scratch.
 */
const rescueArguments = (descriptorType: DescriptorType, args: any[]): any[] =>
    descriptorType === 'get' ? [] : args;

/**
 * True when a feature delivers a value to its caller, so that returning a promise
 * instead of a result is a declaration mistake.
 *
 * A write and a deletion have no result the caller receives: the lifecycle carries
 * the assigned value or a boolean verdict. Storing a promise in a field is
 * ordinary — a body may keep one for a later `await` — so the async rule must not
 * reach these paths, or an assignment is reported as a missing `async` keyword
 * naming a property instead of a feature.
 */
const deliversValue = (descriptorType: DescriptorType): boolean =>
    descriptorType === 'func' || descriptorType === 'get';

/**
 * True when an error is a contract failure raised by `@invariant`.
 *
 * Used to tell "the instance is broken" apart from "something else failed and the
 * instance may also be broken". The two are handled differently: a broken instance
 * is the state a handler must repair, so it is never re-tested before the handler
 * runs, and a second failure is not invented on top of the first.
 */
const isInvariantFailure = (error: unknown): boolean =>
    error instanceof AssertionError && error.violation?.contract === '@invariant';

/**
 * Raises an invariant failure in place of the error that revealed it.
 *
 * A body or postcondition error can leave the instance in a state the invariant
 * rejects. That failure supersedes the original, because it is the state the caller
 * has to repair, but the original is what explains how the instance got there, so it
 * travels as `cause`.
 */
const supersede = (invariantError: unknown, original: unknown): unknown => {
    if (invariantError instanceof AssertionError
        && typeof original === 'object' && original !== null
        && !Object.hasOwn(invariantError, 'cause'))
        Object.defineProperty(invariantError, 'cause', {
            value: original,
            enumerable: false,
            configurable: true,
        });

    return invariantError;
};

/**
 * Raises an invariant failure in place of the error that revealed it.
 *
 * A body or postcondition error can leave the instance in a state the invariant
 * rejects. That failure supersedes the original, because it is the state the caller
 * has to repair, but the original is what explains how the instance got there, so it
 * travels as `cause`. When the instance is still valid the original error stands.
 */
const surfaceInvariantFailure = (
    Class: typeof Contracted,
    target: Contracted,
    error: unknown,
): unknown => {
    if (isInvariantFailure(error)) return error;

    try {
        assertInvariants(Class, target);
    } catch (invariantError) {
        return supersede(invariantError, error);
    }

    return error;
};

/**
 * Decides what a failed invocation does next.
 *
 * Every lifecycle needs the same three decisions at its `@rescue` boundary:
 * whether another retry is permitted, what the handler asked for, and what happens
 * to an instance the failure left invalid. Extracted because the sync and async
 * lifecycles had this block verbatim twice.
 *
 * The sync and async lifecycles are separate functions on purpose: a lifecycle
 * that awaited unconditionally would make every synchronous feature return a
 * promise, which is not a refactor but a change to every caller. What is shared
 * is the decision, not the boundary.
 *
 * @returns The arguments to retry with, or the error is rethrown.
 */
function attemptRescue(
    Class: typeof Contracted,
    target: Contracted,
    prop: PropertyKey,
    error: unknown,
    retries: number,
    args: any[],
): any[] {
    const declaration = getRescueDeclaration(target, prop),
        maxRetries = declaration?.maxRetries ?? Infinity;

    if (!declaration || retries >= maxRetries) {
        // The error is on its way to the caller, so the invariant is checked one last
        // time: an invalid instance is the state the caller has to repair, and that
        // failure supersedes the error which revealed it.
        //
        // A handler is not given this check, because it is the thing that repairs the
        // state: re-testing first would report the failure it was called to fix. The
        // consequence is that a handler observes the error that failed — the body's
        // own error when the body threw — while the caller may receive the superseding
        // invariant failure. A class-level `@rescue` serves features that fail in
        // different ways, so that asymmetry is visible there; the handler's subject
        // carries the failing feature's name, which is what it dispatches on.
        throw surfaceInvariantFailure(Class, target, error);
    }

    try {
        return applyRescueHandler(target, prop, error, args);
    } catch (rescuedError) {
        // The handler ran and either threw its own error or returned without asking
        // for a retry. Its repair is over by this point, so an instance it left
        // invalid is reported rather than passed over, and the original is carried as
        // `cause`. Routing through the same helper keeps the caller's error identical
        // whichever path produced it.
        throw surfaceInvariantFailure(Class, target, rescuedError);
    }
}

/**
 * Runs the entry invariant for one invocation, giving a `@rescue` one chance to
 * repair it.
 *
 * This is the one boundary a retry cannot restart: nothing has run yet, so the
 * handler's repair is the only thing the next check can observe. A second attempt
 * after a repair that did not satisfy the invariant would fail identically, so the
 * failure is surfaced rather than spent against the retry budget.
 *
 * The exit side needs no equivalent: a retried body can genuinely change the state it
 * returns to, which is why `retry` is unbounded there by default.
 *
 * @param state - The call's argument list and retry count, which the handler may
 *   replace and which the repair consumes.
 * @throws Whatever the invariant raises once the repair attempt is spent.
 */
function enterWithRepair(
    Class: typeof Contracted,
    target: Contracted,
    prop: PropertyKey,
    state: { args: any[], retries: number },
): void {
    for (let repairs = 0; ;) {
        try {
            assertInvariants(Class, target);

            return;
        } catch (error) {
            if (repairs++ > 0) throw error;

            state.args = attemptRescue(Class, target, prop, error, state.retries, state.args);
            state.retries++;
        }
    }
}

/**
 * Runs the assertion lifecycle for a single public invocation.
 *
 * The contracts describe the observable boundary of a feature, in the sense of
 * a Hoare triple `{ P } C { Q }`: `@demands` is `P`, `@ensures` is `Q`, and the
 * feature body is `C`. Nothing inside `C` is constrained — a body may mutate its
 * own state, including public properties, and may call its own features without
 * re-entering the contracts. Correctness is the obligation that `P` and `Q` hold
 * at the boundary, with the invariant additionally holding on entry and exit.
 *
 * Order: `@invariant` -> `@demands` -> body -> `@ensures` -> `@invariant`
 * (see `docs/happy-path.png`).
 *
 * A `@rescue` may call `retry`, which restarts the lifecycle from `@invariant`
 * with the supplied arguments, so a retried invocation is subject to
 * `@demands` and `@ensures` like any other invocation
 * (see `docs/order-of-assertions.png`).
 *
 * A retried invocation that fails re-enters `@rescue`, so the handler runs once
 * per attempt. This is what N-Version programming requires: a handler can
 * select the next alternative each time it is executed. Retries are bounded by
 * the optional `maxRetries` option on the `@rescue` declaration.
 *
 * The exit boundary sits wherever the body's result becomes observable, so a
 * synchronous and an asynchronous body are run by separate functions below and
 * dispatched by `runLifecycle`.
 *
 * @param invokeArgs - The arguments for this invocation. `retry` replaces them.
 * @param invoke - Performs the feature body with the supplied arguments.
 */
function runSyncLifecycle(
    descriptorType: DescriptorType,
    target: Contracted,
    prop: PropertyKey,
    invokeArgs: any[],
    invoke: (args: any[]) => any,
): any {
    const Class = target.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[prop] ?? [] as EnsuresPredicate<Contracted>[],
        hasEnsures = es.length > 0;

    let args = invokeArgs,
        retries = 0;

    for (; ;) {
        const old = hasEnsures ? populateOld(target) : undefined;

        // The entry invariant may be repaired once by a `@rescue`; see `enterWithRepair`.
        // It is inside the lifecycle so that a broken instance is not unrecoverable:
        // every accessor throws on exit, so a handler could not otherwise reach the
        // state it would fix.
        const state = { args, retries };

        enterWithRepair(Class, target, prop, state);
        args = state.args;
        retries = state.retries;

        // `@demands` sits outside every `try`. A precondition rejects a call that has
        // not begun, so there is no body to resume, and a handler that retried with
        // an argument the precondition also rejects would recurse without end. A
        // failed precondition therefore reaches the caller directly.
        args = assertDemands(target, prop, args);

        let result: any;
        try {
            result = invoke(args);

            if (deliversValue(descriptorType))
                assertNotThenable(result, target, prop);

            if (hasEnsures)
                result = assertEnsures(target, old, prop, ensuresArgs(descriptorType, result, args), result);

            assertInvariants(Class, target);
        } catch (error) {
            args = attemptRescue(Class, target, prop, error, retries,
                rescueArguments(descriptorType, args));
            retries++;
            continue;
        }

        return result;
    }
}

/**
 * Runs the exit half of an `async` feature: its postcondition, then the invariant.
 *
 * The two are one unit because both belong to the moment the body's value becomes
 * observable, and separating them would let a caller check the postcondition and
 * forget the invariant.
 *
 * It is deliberately not `async`. A promise is returned only when an arm declared
 * `awaitPredicate`, so a feature whose arms all answer synchronously keeps both
 * checks in the tick the body settled in. Awaiting unconditionally would schedule
 * the exit `@invariant` a microtask later for every `@ensures`, and a concurrent
 * caller resuming into that tick could observe state the check has not approved.
 *
 * @returns The value to hand the caller, or a promise for it when an arm must be
 *   awaited.
 */
function runExit(
    Class: typeof Contracted,
    descriptorType: DescriptorType,
    target: Contracted,
    prop: PropertyKey,
    args: any[],
    result: unknown,
    old: Contracted | undefined,
    hasEnsures: boolean,
    awaitEnsures: boolean,
): unknown {
    if (!hasEnsures) {
        assertInvariants(Class, target);

        return result;
    }

    const subject = ensuresArgs(descriptorType, result, args);

    if (!awaitEnsures) {
        const checked = assertEnsures(target, old!, prop, subject, result);

        assertInvariants(Class, target);

        return checked;
    }

    return runAwaitedPostcondition(Class, target, assertEnsuresAsync(target, old!, prop, subject, result));
}

/**
 * Waits for a pending postcondition and then checks the exit invariant.
 *
 * The invariant runs after the settlement because that is the only point at which
 * the feature's value and the state the body reached are both final.
 */
async function runAwaitedPostcondition(
    Class: typeof Contracted,
    target: Contracted,
    pending: Promise<unknown>,
): Promise<unknown> {
    const settled = await pending;

    assertInvariants(Class, target);

    return settled;
}

/**
 * Runs the contract lifecycle whose exit boundary is a promise settlement.
 *
 * An `async` body returns its promise from `Reflect.apply` before a single line
 * of it has run, so evaluating `@ensures` there would test a body that has not
 * executed. The exit boundary must therefore *follow* the value: the lifecycle
 * waits for the promise to settle and then runs `@ensures` and the exit
 * `@invariant` against the settled state.
 *
 * Two consequences shape this loop.
 *
 * The first is failure surface. A contract that is violated on entry is a
 * synchronous throw in `runSyncLifecycle`, but that would be a lie here: an
 * `async` function never throws synchronously, so a caller that adds a
 * precondition must not change how a failure is observed. Entry violations are
 * therefore delivered as a rejection, exactly as the undecorated body's own
 * throws are. Substituting a contracted implementation for a plain one is
 * transparent to the caller, which is the substitutability Liskov requires and
 * which the type system already enforces in both directions (`() => T` and
 * `() => Promise<T>` are mutually non-assignable, so neither is a subtype of the
 * other and no conversion is implied).
 *
 * The second is that `@rescue` must observe rejections, not just synchronous
 * throws. A rescue that retries restarts the lifecycle, so a retried attempt is
 * subject to every contract like any other invocation.
 */
async function runAsyncLifecycle(
    descriptorType: DescriptorType,
    target: Contracted,
    prop: PropertyKey,
    invokeArgs: any[],
    invoke: (args: any[]) => any,
): Promise<any> {
    const Class = target.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[prop] ?? [] as EnsuresPredicate<Contracted>[],
        hasEnsures = es.length > 0,
        // Resolved once: the metadata record is fixed for the class, so whether an
        // arm asked to be awaited cannot change during a call. Each reports false
        // for a feature with no arms, so neither needs a separate check.
        awaitDemands = demandsAwaitable(target, prop),
        awaitEnsures = ensuresAwaitable(target, prop);

    let args = invokeArgs,
        retries = 0;

    for (; ;) {
        const old = hasEnsures ? populateOld(target) : undefined;

        // The same entry boundary as the synchronous lifecycle. Because this function
        // is `async`, an entry failure is delivered as a rejection rather than a
        // synchronous throw, which keeps the failure surface identical to the
        // undecorated body's.
        const state = { args, retries };

        enterWithRepair(Class, target, prop, state);
        args = state.args;
        retries = state.retries;

        // Outside the rescuable scope, for the reason given in the synchronous
        // lifecycle: a rejected precondition has no body to resume, and a retry
        // whose argument it also rejects would recurse without end.
        //
        // The awaited composition is chosen only when an arm declared
        // `awaitPredicate`; otherwise the synchronous one decides the precondition
        // without handing the caller a promise to wait on for a verdict that is
        // already settled.
        args = awaitDemands
            ? await assertDemandsAsync(target, prop, args)
            : assertDemands(target, prop, args);

        let result: any;
        try {
            result = await invoke(args);

            // The postcondition and the exit invariant form one boundary, and the
            // invariant must not be skipped when a postcondition has to be awaited,
            // so the two are run together rather than inline here. `awaitEnsures`
            // alone decides the wait: it is false when there is no postcondition to
            // check as well as when none of its arms asked to be awaited.
            const exit = runExit(
                Class, descriptorType, target, prop, args, result, old, hasEnsures, awaitEnsures);

            result = awaitEnsures ? await exit : exit;
        } catch (error) {
            args = attemptRescue(Class, target, prop, error, retries,
                rescueArguments(descriptorType, args));
            retries++;
            continue;
        }

        return result;
    }
}

/**
 * Runs the contract lifecycle whose boundary is a generator's iterator.
 *
 * A generator does not have one exit boundary: it has a boundary per *step*.
 * Calling `obj.gen(...)` starts the body but its first line has not run, and each
 * `next()` runs the body until the following `yield`. A yield is therefore the
 * observable delivery of a traversal, which is what `@ensures` describes, and the
 * contracts bracket it accordingly:
 *
 * ```
 * call   -> @invariant, @demands      (the call arguments are `P`)
 * next() -> body to the next yield
 *        -> @ensures, @invariant      (the yielded value and the new state are `Q`)
 * ```
 *
 * This is the same sandwich the diagram shows for an ordinary feature
 * (`docs/order-of-assertions.png`), applied once per step. The exit `@invariant`
 * is what closes the window between yields: a suspended generator's instance is
 * publicly reachable, so another feature can be called on it, and that call's
 * entry check is the guarantee that it never observes an invalid object.
 *
 * Checking the invariant *before* handing over a value is not possible — the
 * segment is not finished at the `yield` — so resuming is where the previous
 * step's exit check happens. The terminal step resumes into the same point and
 * then reports `done`, so completion is covered without extra machinery.
 *
 * `@demands` describes the call, so it runs once. A later step may also be
 * *given* a value through `next(value)`, which arrives as the value of the
 * preceding `yield` expression and is entirely outside the arguments of the
 * call. That input is checked when it is present and skipped when it is not,
 * because `for...of` iterates with `next()` and would otherwise re-enter the
 * precondition with `undefined` and fail it.
 *
 * `@rescue` is the outer scope, as it is for an `async` feature: it covers a
 * throw that escapes a step, and `retry` restarts the traversal. Rescuing a
 * single step would require resuming a generator that has already been consumed,
 * which the language cannot express.
 */
function runGeneratorLifecycle(
    target: Contracted,
    prop: PropertyKey,
    invokeArgs: any[],
    invoke: (args: any[]) => any,
    kind: 'generator' | 'async-generator',
): any {
    const Class = target.constructor as typeof Contracted,
        es = Class[Symbol.metadata]?.ensures?.[prop] ?? [] as EnsuresPredicate<Contracted>[],
        hasEnsures = es.length > 0;

    /*
     * A generator has a boundary per *step*, not one per call. Calling the
     * feature runs nothing, and each `next()` runs the body from where it was
     * suspended up to the following `yield`. When `next()` returns, the segment
     * has finished and the instance holds the state it will be observed with, so
     * the exit contracts run there, before the caller is given the value:
     *
     *     call    -> @invariant, @demands          the call arguments are `P`
     *     next()  -> @invariant                    entry of the step
     *     segment -> body to the next yield
     *     next()  -> @ensures, @invariant          the yielded value and state
     *
     * This is the sandwich in `docs/order-of-assertions.png` applied once per
     * step, and it gives the invariant the same guarantee it has elsewhere: no
     * public interaction leaves the object invalid. That matters more here than
     * anywhere else, because a suspended generator's instance is publicly
     * reachable and another feature can be called on it between yields. Checking
     * only at completion would leave the object knowingly invalid for the whole
     * traversal, and would never check at all if the iterator were abandoned.
     */

    // The iterator in play. A `@rescue` that retries replaces it.
    let iterator: any,
        args = invokeArgs,
        retries = 0,
        // The invariant has not been evaluated since the traversal began.
        needsEntry = true,
        // The error a `@rescue` handled by retrying, raised if the retried
        // traversal then completes without producing a value.
        retriedError: unknown;

    /**
     * Runs the entry contracts for a step.
     *
     * `@demands` describes the call, so it runs once, on the first step. A later
     * step may be *given* a value through `next(value)`, which becomes the value
     * of the preceding `yield` expression and is not an argument of the call;
     * that input is checked as a precondition when it is present. `for...of`
     * iterates with `next()` and injects nothing, so it never re-enters the
     * precondition with `undefined`.
     */
    const enter = (stepArgs: any[]): any[] => {
        assertInvariants(Class, target);

        if (needsEntry) {
            needsEntry = false;

            return assertDemands(target, prop, args);
        }

        // A value injected with `next(value)` is an input to the step, so it is
        // the subject a precondition describes. `for...of` injects nothing, so
        // it never re-enters the precondition with `undefined`.
        return stepArgs.length > 0 ? assertDemands(target, prop, stepArgs) : stepArgs;
    };

    /**
     * Runs the exit contracts for a step that produced a value.
     */
    const exit = (value: any, old: Contracted | undefined) => {
        if (hasEnsures) assertEnsures(target, old!, prop, [value], value);

        assertInvariants(Class, target);

        // A value was delivered, so the retry that recovered the traversal has
        // been observed and the error it handled no longer needs reporting.
        retriedError = undefined;
    };

    /**
     * Raises the error a retry was recovering from, when the retried traversal
     * completes without a value. Nothing observed that value, so the caller who
     * triggered the rescue is told why rather than being handed `undefined`.
     */
    const reportRetried = () => {
        assertInvariants(Class, target);

        if (retriedError === undefined) return;

        const error = retriedError;

        retriedError = undefined;

        throw error;
    };

    /**
     * Rebuilds the traversal after a `@rescue` retried.
     *
     * A generator that has already been consumed cannot be resumed from the
     * beginning, so a retry restarts it: `retry` reruns the body, exactly as the
     * loop back to `@invariant` in `docs/order-of-assertions.png` says it does.
     */
    const prepareRetry = (error: unknown) => {
        args = attemptRescue(Class, target, prop, error, retries, args);
        retries++;
        iterator = invoke(args);
        needsEntry = true;
        retriedError = error;
    };

    /**
     * Drives one step of a synchronous generator.
     */
    const drive = (advance: (iterator: any, stepArgs: any[]) => any, stepArgs: any[]): any => {
        for (; ;) {
            try {
                // A normalizing schema on an injected value replaces the
                // arguments for this step, so the value the body receives is the
                // one the schema produced.
                stepArgs = enter(stepArgs);

                // `old` describes the state the segment is about to change, so
                // it is taken before the body advances.
                const old = hasEnsures ? populateOld(target) : undefined,
                    result = advance(iterator, stepArgs);

                if (result.done) {
                    reportRetried();

                    return result;
                }

                exit(result.value, old);

                return result;
            } catch (error) {
                prepareRetry(error);
            }
        }
    };

    /**
     * Drives one step of an asynchronous generator, awaiting its segment.
     */
    const driveAsync = async (advance: (iterator: any, stepArgs: any[]) => Promise<any>, stepArgs: any[]): Promise<any> => {
        for (; ;) {
            try {
                stepArgs = enter(stepArgs);

                const old = hasEnsures ? populateOld(target) : undefined,
                    result = await advance(iterator, stepArgs);

                if (result.done) {
                    reportRetried();

                    return result;
                }

                exit(result.value, old);

                return result;
            } catch (error) {
                prepareRetry(error);
            }
        }
    };

    // The call's entry contracts run when the feature is called, matching the
    // arrow out of `obj.feature(...)` in the diagram. The body itself does not
    // start until the iterator is resumed, so this is the same entry boundary as an
    // ordinary feature and goes through the same helper.
    //
    // `@demands` stays outside, for the reason given in the synchronous lifecycle: a
    // rejected precondition has no traversal to resume, and a retry that violated it
    // again would recurse without end.
    const entry = { args, retries };

    enterWithRepair(Class, target, prop, entry);
    args = entry.args;
    retries = entry.retries;

    args = assertDemands(target, prop, args);
    needsEntry = false;
    iterator = invoke(args);

    const wrapper: any = {};

    if (kind === 'generator') {
        // `arguments.length` distinguishes `next()` from `next(undefined)`, which
        // the engine treats differently: only an explicit value is injected.
        wrapper.next = function (...stepArgs: any[]) {
            return drive((current, args) => current.next(args[0]), stepArgs);
        };
        wrapper.return = function (...returnArgs: any[]) {
            return drive((current, args) => current.return(returnArgs[0] ?? args[0]), []);
        };
        wrapper.throw = function (...errorArgs: any[]) {
            return drive((current, args) => current.throw(errorArgs[0] ?? args[0]), []);
        };
        wrapper[Symbol.iterator] = function () { return this; };
    }
    else {
        wrapper.next = function (...stepArgs: any[]) {
            return driveAsync((current, args) => current.next(args[0]), stepArgs);
        };
        wrapper.return = function (...returnArgs: any[]) {
            return driveAsync((current, args) => current.return(returnArgs[0] ?? args[0]), []);
        };
        wrapper.throw = function (...errorArgs: any[]) {
            return driveAsync((current, args) => current.throw(errorArgs[0] ?? args[0]), []);
        };
        wrapper[Symbol.asyncIterator] = function () { return this; };
    }

    return wrapper;
}

/**
 * Selects the lifecycle boundary for a feature body.
 *
 * An `async` body is awaited through `runAsyncLifecycle` and a generator is
 * wrapped by `runGeneratorLifecycle`; anything else is evaluated synchronously.
 * This is decided from the function itself rather than from whether the result
 * *looks* like a promise, so a synchronous feature that happens to return a
 * thenable is still checked synchronously — the contract describes the feature as
 * written, and such a feature's postcondition cannot hold anyway because its body
 * has not finished. `@demands` therefore fails it with a message naming the
 * feature.
 */
function runLifecycle(
    descriptorType: DescriptorType,
    target: Contracted,
    prop: PropertyKey,
    invokeArgs: any[],
    invoke: (args: any[]) => any,
    kind: FeatureKind = 'sync',
): any {
    if (kind === 'async')
        return runAsyncLifecycle(descriptorType, target, prop, invokeArgs, invoke);

    if (kind === 'generator' || kind === 'async-generator')
        return runGeneratorLifecycle(target, prop, invokeArgs, invoke, kind);

    return runSyncLifecycle(descriptorType, target, prop, invokeArgs, invoke);
}

/**
 * Rejects a thenable returned by a feature that is not declared `async`.
 *
 * A synchronous feature's contracts are evaluated when its body returns, so a
 * body that defers its work through a promise is checked before it has done
 * anything. `@ensures` would then describe a state the feature has not reached
 * yet, and the caller would receive a promise whose outcome no contract ever
 * observed.
 *
 * The alternative — awaiting any thenable — was rejected because it would make
 * `async` optional while silently changing when failure is reported: a plain
 * function cannot return a settled value for a rejection to accompany, so the
 * feature would have to become `async` for its errors to be observable anyway.
 * Failing closed keeps the declaration and the boundary in agreement, and the
 * message says what to do.
 */
const assertNotThenable = (result: unknown, target: Contracted, prop: PropertyKey): void => {
    if (result === null || typeof result !== 'object' && typeof result !== 'function') return;

    if (typeof (result as any).then !== 'function') return;

    throw new AssertionError(
        `${classNameOf(target.constructor)}.${String(prop)} returned a promise but is not declared 'async', `
        + "so its contracts were evaluated before its body finished. Declare the feature 'async'.",
    );
}

/**
 * Performs the assignment a `set` trap authorised.
 *
 * `Reflect.set` is called without a receiver on purpose. Passing the proxy would
 * route the write back through the `defineProperty` trap, which refuses an
 * external definition of a public property. The name is already authorised by the
 * caller, so writing the target directly performs exactly that mutation.
 *
 * @returns Whether the target accepted the write. A setter's assignment is
 *   reported as accepted, because the setter ran.
 */
const performSet = (
    target: Contracted,
    prop: PropertyKey,
    value: unknown,
    setter: ((value: unknown) => void) | undefined,
): boolean => {
    if (setter) {
        setter.call(target, value);

        return true;
    }

    // A target that cannot accept the write, because `Object.freeze` or
    // `Object.preventExtensions` was applied, reports `false`, which strict mode
    // turns into a `TypeError`.
    return Reflect.set(target, prop, value);
};

/**
 * Refuses an instance-level write to an enforcement switch.
 *
 * The switches are static, so a write here could only land on the raw target,
 * out of reach of every trap. A switch a caller can set is a guarantee a caller
 * can remove, so the attempt is refused wherever it happens — including when both
 * switches are off, because that is exactly the state a caller would want to
 * escape from.
 */
const refuseSwitchWrite = (prop: PropertyKey): void => {
    if (!isSwitch(prop)) return;

    throw new TypeError(
        `Cannot set '${String(prop)}' on a Contracted instance: enforcement is switched on the class, `
        + `not on an instance. Assign '${String(prop)}' on the class itself.`,
    );
};

const proxyHandler: ProxyHandler<Contracted> = {
    get(target, prop, receiver) {
        const { contracts } = enforcementFor(target.constructor);

        // With the contracts off, every member is returned unwrapped, so a feature
        // call and a field read look the same and no lifecycle starts.
        if (!contracts) return Reflect.get(target, prop, receiver);

        const descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop);

        if (typeof descriptor?.value === 'function') {
            let cache = wrapperCache.get(target);

            if (!cache) {
                cache = new Map();
                wrapperCache.set(target, cache);
            }

            const cached = cache.get(prop);

            if (cached) return cached;

            const kind = featureKindOf(descriptor.value);

            // The descriptor is resolved from the instance's prototype chain,
            // which is fixed for the lifetime of the instance, so the wrapper
            // can be reused for that feature.
            //
            // The body receives the raw target as `this`. A feature body is `C`
            // in `{ P } C { Q }`: what it does internally is unconstrained, so
            // internal accesses must not re-enter the traps.
            const wrapper = function (this: Contracted, ...methodArgs: any[]) {
                return runLifecycle('func', target, prop, methodArgs,
                    (args) => Reflect.apply(descriptor.value!, target, args), kind);
            };

            cache.set(prop, wrapper);

            return wrapper;
        }
        else if (typeof descriptor?.get === 'function')
            return runLifecycle('get', target, prop, [],
                () => descriptor.get!.call(target), featureKindOf(descriptor.get!));
        else
            return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value) {
        refuseSwitchWrite(prop);

        const { contracts, encapsulation } = enforcementFor(target.constructor),
            descriptor = getPropertyDescriptor(Object.getPrototypeOf(target), prop),
            setter = typeof descriptor?.set === 'function' ? descriptor.set : undefined;

        // Encapsulation is the name check below: it exists so a caller cannot
        // mutate state without a postcondition to catch it. It governs the external
        // surface only — inside a body, `@ensures` and `@invariant` provide that
        // guarantee instead.
        //
        // The switch removes this verdict, not the lifecycle. A permitted write is
        // still a feature invocation, so it is bracketed like any other and a
        // setter's postcondition describes it. Skipping the lifecycle here would
        // make the two switches dependent after all: turning encapsulation off
        // would silently stop the contracts running on every write.
        if (encapsulation && !setter && typeof prop === 'string' && !prop.startsWith('_'))
            throw new TypeError(`Cannot assign to property '${String(prop)}': only properties starting with '_' or with a setter can be set on Contracted instances.`);

        // Only the contracts describe a feature; the write itself is a property of
        // the trap. With the contracts off the assignment runs directly.
        if (!contracts) return performSet(target, prop, value, setter);

        // A setter's lifecycle result is the assigned value, which is what a
        // postcondition describes. Whether the write was accepted is a property of
        // the trap rather than of the feature, so it is tracked separately instead
        // of being inferred from that value — `false` is both a legitimate value to
        // assign and the failure `Reflect.set` reports.
        let accepted = true;

        runLifecycle('set', target, prop, [value],
            (args) => {
                accepted = performSet(target, prop, args[0], setter);

                return args[0];
            });

        return accepted;
    },
    defineProperty(target, prop, descriptor) {
        refuseSwitchWrite(prop);

        if (!enforcementFor(target.constructor).encapsulation)
            return Reflect.defineProperty(target, prop, descriptor);

        // Defining a property is an external mutation, so it follows the same
        // rule as assignment. Redefining a public field escapes the
        // postcondition that would have caught the change, and replacing a
        // contracted method routes callers around its `@demands` and
        // `@ensures`.
        //
        // Only `_`-prefixed names are permitted. A prototype setter does not
        // widen this: assignment invokes the setter, while defining an own
        // data property shadows the accessor.
        //
        // A descriptor carrying neither a value nor an accessor cannot change
        // or shadow state, so any name is permitted. `Object.freeze` and
        // `Object.seal` define such descriptors for each existing property,
        // and refusing them would make an instance impossible to freeze.
        const freezesOnly = !('value' in descriptor) && !('get' in descriptor) && !('set' in descriptor);

        if (!freezesOnly && typeof prop === 'string' && !prop.startsWith('_'))
            throw new TypeError(
                `Cannot define property '${String(prop)}' on Contracted instances: only properties starting with '_' can be defined.`
                + ' A feature body may change its own state, but an external caller must go through a method or a setter.',
            );

        return Reflect.defineProperty(target, prop, descriptor);
    },
    setPrototypeOf(target, prototype) {
        // Replacing the prototype is an external mutation of the instance, so
        // encapsulation governs whether it is permitted. It is not a feature call,
        // so no lifecycle would have run for it either way.
        if (!enforcementFor(target.constructor).encapsulation)
            return Reflect.setPrototypeOf(target, prototype);

        // Replacing the prototype swaps which descriptors a feature resolves to.
        // The per-feature wrappers are cached against `prop` for the lifetime of
        // the instance and would then dispatch to the wrong function, and the
        // contract metadata is reached through the constructor, so the instance
        // would report one class's contracts while running another's methods.
        throw new TypeError(
            'Cannot change the prototype of a Contracted instance: it would detach the instance from the features and contracts it was constructed with.',
        );
    },
    preventExtensions(target) {
        // Permitted for any property name: it changes no state and shadows no
        // accessor. The `set` trap reports the write failures that follow.
        return Reflect.preventExtensions(target);
    },
    deleteProperty(target, prop) {
        refuseSwitchWrite(prop);

        const { contracts, encapsulation } = enforcementFor(target.constructor);

        // Deletion follows the same rule as assignment: it is an external mutation,
        // so it is subject to encapsulation and to the lifecycle. Only `_`-prefixed
        // properties, the ones a caller is allowed to mutate in the first place, may
        // also be removed.
        //
        // The switch removes this verdict, not the lifecycle, for the reason `set`
        // gives: a permitted deletion is still an external mutation of the instance,
        // so its `@invariant` still has to hold afterwards.
        if (encapsulation && typeof prop === 'string' && !prop.startsWith('_'))
            throw new TypeError(`Cannot delete property '${String(prop)}' from Contracted instances: only properties starting with '_' can be deleted.`);

        if (!contracts) return Reflect.deleteProperty(target, prop);

        return runLifecycle('delete', target, prop, [], () => Reflect.deleteProperty(target, prop));
    },
};

export class Contracted {
    /**
     * The contracts declared on this class, keyed by the feature they belong to.
     *
     * `undefined` when the class declares none, because the metadata record is
     * created by the first decorator to run rather than by the class itself.
     *
     * Read it through {@link getContractMetadata} rather than indexing this symbol:
     * the accessor returns copies, so a consumer cannot corrupt the contracts a
     * class is checked against by mutating what it was handed.
     *
     * The shape is stable for the major version. Fields may be added, but an
     * existing field will not change meaning without one.
     */
    static [Symbol.metadata]: ContractMetadata | undefined;

    /**
     * Grants permission for exactly one `Contracted` constructor call.
     *
     * A boolean would leave the gate open for the whole duration of the
     * constructor, so a class that called `new Foo()` inside its own
     * constructor — directly or through a superclass — would obtain a raw,
     * unproxied instance and defeat every contract.
     *
     * `Contracted`'s constructor runs exactly once per construction, so a
     * single-use token is enough. Classes that do not declare their own
     * constructor call it implicitly; classes that do must call `super()` once.
     */
    protected static _allowedConstructions = 0;

    /**
     * Whether the contracts declared on this class are evaluated.
     *
     * Assign it on a class to opt that class — and any class extending it that
     * does not declare its own — out of `@invariant`, `@demands`, `@ensures`, and
     * `@rescue`, without affecting a sibling or the rest of the process:
     *
     * ```typescript
     * class DataHolder extends Contracted {
     *     static [checkedMode] = false;
     * }
     * ```
     *
     * It is separate from {@link encapsulationMode} so a class can keep the write
     * protection while skipping the checks. Both default to `true`, and the
     * nearest declaration on the class chain decides.
     *
     * Set it **through the class**. An instance write would land on the raw target,
     * where no trap can refuse it.
     */
    public static [checkedMode]: boolean = true;

    /**
     * Whether an external write, definition, or deletion on this class's instances
     * is trapped.
     *
     * Assign it on a class exactly as {@link checkedMode}, with the same scope: the
     * class and the subclasses that do not declare their own. Disabling it makes
     * the instance behave like a plain object for mutation, while the contracts
     * still run when `checkedMode` is left on.
     */
    public static [encapsulationMode]: boolean = true;

    static new<
        C extends typeof Contracted,
        Args extends ConstructorParameters<C>,
    >(this: C, ...args: Args): InstanceType<C> {
        const previous = (this as any)._allowedConstructions;

        (this as any)._allowedConstructions = previous + 1;

        try {
            const instance = new this(...args) as InstanceType<C>;
            assertInvariants(this, instance);

            return new Proxy<InstanceType<C>>(instance, proxyHandler);
        } finally {
            // Restore rather than decrement: the constructor consumes the token,
            // so decrementing here would double-count. Restoring also clears it
            // if the constructor threw for any reason.
            (this as any)._allowedConstructions = previous;
        }
    }

    constructor(..._args: any[]) {
        const Class = this.constructor as typeof Contracted;

        if (Class._allowedConstructions <= 0)
            throw new TypeError("Use the static 'new' method to instantiate this class.");

        // Consume the token so a nested `new` inside a constructor cannot
        // borrow the outer construction's permission.
        Class._allowedConstructions--;
    }
}

/**
 * Installs the `util.inspect` rendering on every contracted class.
 *
 * The surface itself lives in `inspect.mts`, which owns the key it is registered
 * under; this is the one place a library class is available to attach it to.
 */
installInspect(Contracted.prototype);
