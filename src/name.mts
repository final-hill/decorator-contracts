/**
 * The name a class reports in a contract violation, and how it is resolved.
 *
 * `Class.name` is whatever the consumer's build emitted. The standard decorator
 * lowering wraps a decorated class in an immediately invoked arrow that returns a
 * **class expression**, which a compressor is free to leave anonymous, so the
 * reported name degrades with the build: correct when the bundle is unminified, a
 * short identifier when it is not, and empty when the compressor dropped the name
 * outright.
 *
 * There is no earlier moment with a better name. The class object is created once,
 * and the name a class decorator observes is the same name the violation would
 * report later, so capturing it at decoration time cannot improve it. Only a
 * declaration by the consumer is independent of the build.
 *
 * Declaring one makes the name stable no matter how the bundle is minified, which
 * is what a production `className`, message, or `onViolation` factory needs:
 *
 * ```typescript
 * import { Contracted, contractName } from '@final-hill/decorator-contracts';
 *
 * class Cart extends Contracted {
 *     static [contractName] = 'Cart';
 * }
 * ```
 *
 * A name is declared rather than inherited. `checkedMode` and `encapsulationMode`
 * inherit because they answer how a class *behaves*, and a subclass that says
 * nothing about behaviour should behave like its base. A name answers who the class
 * *is*, so an inherited one would label every subclass's violations with the base's
 * name.
 *
 * Set it **through the class**: it is read from the constructor, so a write to an
 * instance has no effect. Unlike the enforcement switches there is nothing to
 * refuse — a name that does not take effect removes no guarantee.
 *
 * Nothing here imports `Contracted`, so every contract module and the proxy can use
 * it without an import cycle.
 */
export const contractName = Symbol.for('Contracted.contractName');

/**
 * The name to report for `Class` in a contract violation.
 *
 * An own {@link contractName} declaration wins, so a class that declares one is
 * named stably whatever the build did to its class name. Otherwise `Class.name` is
 * reported, which is what the consumer's build emitted.
 *
 * **Own, not inherited**, for the reason {@link contractName} gives. The fallback
 * is also what makes ownership meaningful: a subclass that declares no name reports
 * itself rather than the base whose name it inherited.
 *
 * The declared value is used only when it is a non-empty string, so a declaration
 * that resolves to `undefined` or `''` falls back to `Class.name` rather than
 * producing an empty label. An empty name would render as
 * `@demands failed for .withdraw`, which is the failure this symbol exists to
 * prevent and must not be reachable through a mistyped declaration.
 *
 * A declaration that throws is not a name either. The lookup is wrapped for that
 * reason: a contract failure is the outcome the caller is waiting for, and a
 * declaration is read on the way to reporting it, so a throwing accessor must not
 * replace the failure with its own error. The constructor name is what is left.
 *
 * @param Class - The class to name, passed as the constructor itself (`Cart`).
 *   `instance.constructor` is the same object and may be passed instead, but a
 *   caller that already holds the class needs no instance to name it.
 * @internal
 * Exported only because the contract modules and the proxy live in their own files
 * and import it. Read {@link contractName} instead; it is the published surface.
 */
export const classNameOf = (Class: unknown): string => {
    if (typeof Class !== 'function') return '';

    try {
        const declared = Object.hasOwn(Class, contractName)
            ? (Class as { [contractName]?: unknown })[contractName]
            : undefined;

        if (typeof declared === 'string' && declared.length > 0) return declared;
    } catch {
        // Fall through to the constructor name; see the docblock.
    }

    return (Class as { name: string }).name;
};
