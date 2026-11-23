/**
 * Opt-in JSON serialization for a contracted class.
 *
 * https://github.com/final-hill/decorator-contracts/issues/341
 *
 * A contracted instance serializes its own data properties, which are the
 * `_`-prefixed fields the library's convention marks private:
 *
 * ```text
 * JSON.stringify(instance)   // {"_balance":5,"_orgId":"o"}
 * ```
 *
 * That is a leak, but the fix cannot be a default `toJSON`. Which fields are
 * "public" is a decision about the consumer's domain, and the `_` prefix is a
 * convention the library enforces for assignment rather than a declaration of what
 * may be published. A default would also change what `JSON.stringify` emits for
 * every existing class, which is the kind of silent break a library cannot make.
 *
 * So a class opts in, naming the getters it wants published:
 *
 * ```typescript
 * import { Contracted, serializable } from '@final-hill/decorator-contracts';
 *
 * @serializable('balance', 'orgId')
 * class Account extends Contracted {
 *     protected _balance = 0;
 *     protected _orgId = 'o';
 *
 *     get balance() { return this._balance; }
 *     get orgId() { return this._orgId; }
 * }
 *
 * JSON.stringify(Account.new());   // {"balance":0,"orgId":"o"}
 * ```
 *
 * Naming getters rather than fields is deliberate. A field name is storage; a
 * getter is the class's own statement of what is observable, and it is already the
 * only way an external caller reads state the encapsulation rule protects. The
 * published shape is therefore the shape a caller can already see, and it cannot
 * drift from the class's public surface without the class saying so.
 */

import { assertDecoratorContext } from './decorator.mjs';
import { Contracted } from './Contracted.mjs';
import { classNameOf } from './name.mjs';

/** The property `JSON.stringify` looks for. */
const TO_JSON = 'toJSON';

/**
 * The name a diagnostic reports for `Class`.
 *
 * The class's declared name when it has one, so a message names the class the way
 * every other diagnostic does.
 *
 * @param Class - The constructor the decorator was given.
 */
const nameOf = (Class: unknown): string => classNameOf(Class);

/**
 * The classes this decorator has already been applied to.
 *
 * Recorded so a second application is reported as the duplicate declaration it is,
 * rather than as a conflict with a `toJSON` the author never wrote.
 */
const published = new WeakSet<object>();

/**
 * Resolves a property descriptor from `start` up the prototype chain.
 *
 * Walks the chain because a subclass may publish a getter it inherited.
 *
 * @param start - The prototype to search from.
 * @param feature - The property name.
 */
const descriptorOf = (start: object, feature: string): PropertyDescriptor | undefined => {
    for (let proto: any = start; proto && proto !== Object.prototype; proto = Object.getPrototypeOf(proto)) {
        const descriptor = Object.getOwnPropertyDescriptor(proto, feature);

        if (descriptor) return descriptor;
    }

    return undefined;
};

/**
 * Builds the `toJSON` method for a class that publishes `features`.
 *
 * A getter is read through its descriptor rather than through `this`. The body of a
 * feature runs against the raw target, so `this[feature]` would work here too — but
 * only by accident, and only while nothing changes that. Reaching the descriptor
 * says what is meant: read this getter, now, from the object being written, without
 * depending on how the proxy happens to hand the body its receiver.
 *
 * `toJSON` is itself a public feature, so the proxy brackets it and the entry and
 * exit `@invariant` hold around the whole serialization. A reader learns that the
 * object written is one the instance's invariant accepted.
 *
 * A getter that throws propagates. That is the getter's own behaviour, and
 * suppressing it would emit a partial object that looks complete.
 *
 * @param features - The getter names to publish, in the order they are emitted.
 * @returns The `toJSON` method.
 */
const serializeWith = (features: readonly string[]) =>
    function (this: Contracted): Record<string, unknown> {
        const result: Record<string, unknown> = {},
            // `getPrototypeOf` is not trapped, so this is the class the consumer
            // declared rather than the proxy's wrapper for it.
            start = Object.getPrototypeOf(this);

        for (const feature of features) {
            const descriptor = descriptorOf(start, feature);

            if (descriptor?.get) result[feature] = descriptor.get.call(this);
        }

        return result;
    };

/**
 * Rejects a `@serializable` target that the decorator cannot honour.
 *
 * Four independent declarations are possible and each has its own remedy, so the
 * checks live together rather than interleaved with the installation. Collecting
 * them also keeps the decorator itself a short pipeline, which is what a reader
 * needs from a declaration site.
 *
 * @param Class - The value the decorator was applied to.
 * @param features - The getter names it was given.
 * @throws {TypeError} For the reason each check exists.
 */
function assertPublishable(Class: unknown, features: readonly string[]): asserts Class is typeof Contracted {
    if (Class === null || typeof Class !== 'function' || !(Class.prototype instanceof Contracted))
        throw new TypeError('@serializable decorator can only be applied to classes that extend Contracted');

    if (features.length === 0)
        throw new TypeError(
            '@serializable was given no features, so it would publish an empty object for every instance. '
            + 'Name the getters to publish; a class that publishes nothing does not need the decorator.',
        );

    // An own `toJSON` is the class's own statement of its published shape, so the
    // decorator does not overwrite it. Reported rather than accepted, because the
    // two declarations cannot both be the shape the class publishes and the author
    // needs to know which one is in force. A second application of this decorator
    // lands in the same place, so it is named separately — it is a different
    // mistake and the remedy differs.
    if (!Object.hasOwn(Class.prototype, TO_JSON)) return;

    throw new TypeError(
        published.has(Class)
            ? `${nameOf(Class)} declares @serializable more than once, so two shapes were given for one class. Apply it once with the full list.`
            : `${nameOf(Class)} already declares its own 'toJSON', so the shape it publishes is that method's `
            + 'and not the one @serializable was given. Remove one of the two.',
    );
};

/**
 * Publishes the named getters through `JSON.stringify`.
 *
 * Every name is checked at decoration time, where the author is looking at the
 * declaration, rather than at serialization time where the diagnostic would arrive
 * in a logger.
 *
 * The method is installed on the class's **own** prototype, so a subclass that
 * declares its own `@serializable` publishes its own shape rather than the base's.
 * A subclass that declares nothing inherits the base's publication, which is the
 * substitution rule: the subclass *is* a `Base`, so the shape a `Base` publishes is
 * the shape it publishes. Contrast `contractName`, which is declared rather than
 * inherited because a name answers who a class is, while a serialized shape answers
 * what a class is.
 *
 * @param features - The getter names to publish, in the order they are emitted.
 * @returns A class decorator.
 * @throws {TypeError} If the target is not a `Contracted` class, if no feature is
 *   named, if a named feature is not a getter, or if the class declares its
 *   serialization twice.
 */
export const serializable = (...features: string[]) => (Class: unknown, context: DecoratorContext): void => {
    assertDecoratorContext('@serializable', context);

    if (context.kind !== 'class')
        throw new TypeError('@serializable decorator can only be applied to classes');

    assertPublishable(Class, features);

    for (const feature of features) {
        const descriptor = descriptorOf(Class.prototype, feature);

        if (typeof descriptor?.get !== 'function')
            throw new TypeError(
                `@serializable was given '${feature}', which is not a getter on ${nameOf(Class)}. `
                + 'Name the getters that describe the published shape; a field is storage rather than an observable.',
            );
    }

    Object.defineProperty(Class.prototype, TO_JSON, {
        value: serializeWith(features),
        // Non-enumerable and fixed, so the published shape is the decorator's
        // declaration and not something a caller can replace afterwards.
        enumerable: false,
        writable: false,
        configurable: false,
    });

    published.add(Class);
};
