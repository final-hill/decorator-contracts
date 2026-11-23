/*
 * How a contracted instance describes itself to a debugger.
 *
 * https://github.com/final-hill/decorator-contracts/issues/341
 *
 * Without this, `util.inspect` falls back to the proxy's own rendering, which shows
 * the wrapper rather than the instance:
 *
 * ```text
 * Proxy(Account { _balance: 5, _orgId: 'o' })
 * ```
 *
 * The state is readable there but it is labelled as a proxy, so a reader cannot
 * tell a contracted instance from an accidental one, and a nested instance renders
 * the same way again. `util.inspect` honours a `nodejs.util.inspect.custom` method
 * instead, so one is provided here.
 *
 * ### Why this reads descriptors rather than properties
 *
 * Two facts decide the implementation, and both were measured.
 *
 * `inspect` looks the method up **through the proxy**, so it is the runtime's
 * wrapped feature that is invoked. Node calls that function itself, however,
 * rather than reading the property a second time — a direct
 * `instance[inspectKey]()` runs the contract lifecycle twice, while
 * `inspect(instance)` runs it zero times.
 *
 * A method that therefore read `this._balance` would run a getter through the
 * proxy when one exists, and `inspect` would then throw for exactly the instance a
 * reader is trying to look at. Reading own property **descriptors** instead is
 * outside every trap, which is what a diagnostic surface needs: it reports the
 * state the object holds and cannot fail because a contract does.
 *
 * ### What is shown
 *
 * The class name and the instance's own state, including the `_`-prefixed fields
 * the library's convention marks private. That is the intent here: `inspect` is the
 * surface a developer uses to see what an object actually holds, and hiding the
 * state would make it useless for the one purpose it has. It is not a serialization
 * format — see `serialization.mts` for why that is a separate, opt-in decision.
 */

import { classNameOf } from './name.mjs';

/**
 * The key `util.inspect` looks a custom method up under.
 *
 * This is not a name of this library's choosing: `util.inspect` asks the object for
 * one specific symbol, and `Symbol.for('nodejs.util.inspect.custom')` resolves to
 * it. A symbol made with `Symbol(…)` would be a key nothing looks up, so the method
 * would be inherited by every class and never called.
 *
 * `Symbol.for` rather than importing `node:util` because the registry is shared: a
 * consumer overriding the rendering, and a second copy of this library, both resolve
 * to the same key. Importing the symbol would also make `node:util` a dependency of
 * the module graph, which this library otherwise does not have.
 *
 * Module-private: only the installation site needs it, and a consumer that wants to
 * override the rendering derives the same key from `Symbol.for`.
 */
const inspectKey = Symbol.for('nodejs.util.inspect.custom');

/**
 * What Node renders in place of a value it has been asked not to descend into.
 *
 * Matches the text `util.inspect` produces itself once the depth budget is spent,
 * so a nested instance is abbreviated the same way a nested plain object is.
 */
const NOT_DESCENDED = '[Object]';

/**
 * The instances on the current descent.
 *
 * A reference back to an ancestor would recurse without end, and the ancestry
 * cannot be carried in `options`: Node builds a fresh options object for every
 * level and drops any key it does not know, which was verified. Tracking it here
 * is what keeps a self-referential instance from overflowing the stack.
 *
 * The cost of a module-wide record is that a nested custom inspector which inspects
 * an ancestor sees it still registered and is reported as `[Circular]` even though
 * it is not one. That shape recurses without end under `util.inspect` itself, so a
 * marker is the safer answer; it is recorded here rather than presented as parity.
 */
const rendering = new Set<object>();

/**
 * The own state of `instance`, as the constructor holds it.
 *
 * `Object.getOwnPropertyDescriptors` neither invokes an accessor nor passes through
 * a trap, so this reports what the object holds without running a contract. An
 * accessor is skipped because it holds no state: reading it is exactly the
 * contract-running operation this file exists to avoid, and its value is already
 * visible through the field it reads.
 *
 * @param instance - The instance being described.
 * @returns A key/value list of the own data properties.
 */
const ownState = (instance: object): Array<[string, unknown]> =>
    Object.entries(Object.getOwnPropertyDescriptors(instance))
        .filter(([, descriptor]) => 'value' in descriptor)
        .map(([key, descriptor]) => [key, descriptor.value]);

/**
 * Renders an instance for `util.inspect`.
 *
 * The name is the class's declared one when it has one, and the constructor's
 * otherwise — the same rule every violation message follows, so a class that named
 * itself is named the same way in a debugger as in a failure. The state is read
 * from own descriptors, so no contract runs and no accessor can throw.
 *
 * @param depth - How many levels of nesting `util.inspect` will show; `null` means
 *   unlimited.
 * @param options - The options in force for this inspection.
 * @param inspect - Renders a value with those options, used to recurse.
 * @returns The class name with the instance's own state.
 * @internal
 * Installed on `Contracted.prototype` by `installInspect`; exported so a test can
 * call it directly with the arguments `util.inspect` would pass.
 */
export const inspectInstance = function (
    this: object,
    depth: number | null,
    options: object,
    inspect: (value: unknown, options: object) => string,
): string {
    // `null` is the unlimited depth `util.inspect` uses by default.
    const remaining = depth === null ? Infinity : depth;

    // Node abbreviates a value it has no budget left to descend into, and it counts
    // the instance itself as shown at `depth: 0`, so only a spent budget is
    // abbreviated. Treating `0` as spent would report the instance the caller asked
    // about as `[Object]`.
    if (remaining < 0) return NOT_DESCENDED;

    // A reference back to an instance already on this descent would recurse without
    // end; see `rendering`.
    if (rendering.has(this)) return '[Circular]';

    rendering.add(this);

    try {
        // `getPrototypeOf` is not trapped, so this is the class the consumer
        // declared rather than the proxy's wrapper for it.
        const name = classNameOf(Object.getPrototypeOf(this)?.constructor),
            rendered = ownState(this).map(([key, value]) =>
                `${key}: ${inspect(value, { ...options, depth: remaining - 1 })}`);

        return rendered.length === 0 ? `${name} {}` : `${name} { ${rendered.join(', ')} }`;
    } finally {
        rendering.delete(this);
    }
};

/**
 * Installs the rendering on a class prototype.
 *
 * On the prototype rather than on each instance, so a class pays nothing per
 * instance and a subclass may override it by declaring its own method under the same
 * key.
 *
 * Defined rather than assigned so the property is fixed in place: a caller cannot
 * swap the rendering without the class knowing. `enumerable: false` states the
 * intent — `for...in` never enumerates a symbol key either way, so it changes what a
 * loop sees by nothing, but it is the flag a prototype method would carry.
 *
 * Here rather than in `Contracted.mts` so the key stays module-private: the
 * installation is the only thing that needs it, and every other consumer derives it
 * from `Symbol.for`.
 *
 * @param prototype - The prototype to install on.
 * @internal
 */
export const installInspect = (prototype: object): void => {
    Object.defineProperty(prototype, inspectKey, {
        value: inspectInstance,
        enumerable: false,
        writable: true,
        configurable: true,
    });
};
