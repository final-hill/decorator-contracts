/**
 * Classifies a feature body by how it delivers its results.
 *
 * A Hoare triple `{ P } C { Q }` only means something if `Q` is evaluated after
 * `C` has finished. "Finished" is not the same event for every kind of feature:
 * an `async` body finishes when its promise settles, and a generator finishes a
 * *segment* every time it yields. The kind decides where the exit boundary
 * therefore sits.
 *
 * The classifier lives in its own module because two layers need it and neither
 * should learn the other's vocabulary: the lifecycle dispatches on it, and a
 * decorator refuses a declaration whose boundary cannot honour it. Importing it
 * from `Contracted.mts` would make every decorator depend on the proxy for one
 * `switch`.
 */
export type FeatureKind = 'sync' | 'async' | 'generator' | 'async-generator';

/**
 * Reads a feature's kind from its function object.
 *
 * `Reflect.apply` on an `async` function returns its promise immediately, and on
 * a generator it returns an iterator, so the only reliable signal is the
 * function's constructor, which is stable across bundling and minification
 * (unlike `Function.prototype.name`).
 */
export const featureKindOf = (fn: (...args: any[]) => unknown): FeatureKind => {
    switch (fn.constructor.name) {
        case 'AsyncFunction': return 'async';
        case 'GeneratorFunction': return 'generator';
        case 'AsyncGeneratorFunction': return 'async-generator';
        default: return 'sync';
    }
};
