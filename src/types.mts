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

export type FeatureDecoratorContext = Exclude<ClassMemberDecoratorContext, ClassAccessorDecoratorContext>;