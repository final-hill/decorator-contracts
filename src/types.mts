// Polyfill Symbol.metadata if not present
// ref: https://github.com/microsoft/TypeScript/issues/53461#issuecomment-1736996954
// ref: https://github.com/tc39/proposal-decorator-metadata
(Symbol as any).metadata ??= Symbol.for("Symbol.metadata");

// Extend the global SymbolConstructor type to include metadata
declare global {
    interface SymbolConstructor {
        readonly metadata: symbol;
    }
}

export type Constructor<T> = new (...args: any[]) => T

/**
 * The context a feature contract decorator is applied with.
 *
 * The type parameters are what make a contract predicate inferable. A standard
 * member decorator's context carries the class it is declared on (`This`) and the
 * decorated member's own signature, so stating them here connects the decorator's
 * argument to the member it is applied to. Leaving them out — as the
 * unparameterized `ClassMemberDecoratorContext` does — gives the compiler nothing
 * to infer from, and `self` degrades to the constraint.
 *
 * `Result` is deliberately **not** a parameter here. A method's context carries a
 * call signature (`() => number`) while a getter's carries the property type
 * (`number`), and both would be inference sites for one `Result`, so the compiler
 * resolves it to their intersection — `number & (() => number)`. An `@ensures`
 * predicate therefore keeps `result` at `unknown` and names it with an explicit
 * annotation when it needs more, which is what `EnsuresSubject`'s third parameter
 * is for.
 *
 * `ClassAccessorDecoratorContext` is excluded because the library does not support
 * the `accessor` keyword.
 */
export type FeatureDecoratorContext<This, Args extends any[] = any[]> =
    | ClassMethodDecoratorContext<This, (this: This, ...args: Args) => unknown>
    | ClassGetterDecoratorContext<This, unknown>
    | ClassSetterDecoratorContext<This, unknown>