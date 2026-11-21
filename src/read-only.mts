/**
 * Read-only views of an instance, handed to contract predicates.
 *
 * https://github.com/final-hill/decorator-contracts/issues/191
 *
 * A predicate answers a question; it must not change the state it is asked about.
 * Side effects in a predicate are corrupting rather than merely impure: the
 * predicate runs between the entry and exit `@invariant`, so a write there can
 * hide a violation the invariant would otherwise have reported.
 *
 * `rescue` is deliberately excluded. Restoring corrupted state is its purpose, so
 * it receives the raw target.
 *
 * ### Why a proxy rather than `Object.freeze`
 *
 * Freezing is permanent. A predicate that froze the instance would leave the
 * feature body unable to change it, so every feature on that instance would break:
 *
 * ```text
 * deposit FAILED: TypeError - Cannot assign to read only property '_balance'
 * ```
 *
 * A proxy is scoped to the predicate call, so the body still receives the raw
 * target and mutates normally.
 *
 * ### What is and is not blocked
 *
 * Assignment, deletion, and `defineProperty` on the instance are refused. A
 * mutation *through* a nested value (`self._items.push(x)`) still reaches the
 * shared object, because the proxy only intercepts the instance's own surface.
 * Closing that would require deep-wrapping every value returned from a read,
 * which changes identity for legitimate comparisons such as
 * `old.child === self.child`. The guarantee is therefore "a predicate cannot
 * assign to the instance", which is the case that actually corrupts contract
 * evaluation.
 */

const readOnlyViews = new WeakMap<object, object>();

/**
 * Returns a cached read-only view of `target`.
 *
 * Cached because the same instance is evaluated by several contracts within one
 * lifecycle, and creating a fresh proxy each time would make `self` a different
 * object for each predicate — enough to break a predicate that compares `self`
 * across two contracts.
 */
export const readOnlyView = <T extends object>(target: T): T => {
    const cached = readOnlyViews.get(target);

    if (cached) return cached as T;

    const view = new Proxy(target, {
        set(_target, property) {
            throw new TypeError(
                `A contract predicate may not assign '${String(property)}'. `
                + 'Contract predicates answer a question; they must not change the state they are asked about.',
            );
        },
        deleteProperty(_target, property) {
            throw new TypeError(
                `A contract predicate may not delete '${String(property)}'. `
                + 'Contract predicates answer a question; they must not change the state they are asked about.',
            );
        },
        defineProperty() {
            throw new TypeError(
                'A contract predicate may not define properties. '
                + 'Contract predicates answer a question; they must not change the state they are asked about.',
            );
        },
    });

    readOnlyViews.set(target, view);

    return view;
}
