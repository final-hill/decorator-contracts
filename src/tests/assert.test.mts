import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { assert, AssertionError } from '@final-hill/decorator-contracts';

describe('The assertion function must support assertion signatures from TypeScript 3.7+', () => {
    test('Test assertion', () => {
        nodeAssert.strictEqual(assert(true), undefined);
        nodeAssert.throws(() => assert(false), AssertionError);

        const a: any = 'foo';

        // No type error
        // eslint-disable-next-line no-useless-assignment -- intentional; verifies no type error before the assertion
        let b = 5 * a;

        assert(typeof a === 'string');

        // @ts-expect-error  Type error after assertion
        b = 5 * a;

        nodeAssert(isNaN(b));
    });
});

/** A typed refusal, of the kind a boundary branches on. */
class NotFoundException extends Error {
    override name = 'NotFoundException';
}

/** Reads the error a call raises. */
const raised = (fn: () => unknown): any => {
    try {
        fn();
    } catch (error) {
        return error;
    }

    return nodeAssert.fail('expected the call to raise');
};

describe('`assert` raises the error it is given', () => {
    test('the default is the library\'s `AssertionError`', () => {
        const error = raised(() => assert(false));

        nodeAssert.strictEqual(error instanceof AssertionError, true);
        nodeAssert.strictEqual(error.name, 'AssertionError');
        nodeAssert.strictEqual(error.message, 'Assertion Error');
    });

    test('a supplied constructor decides the type the caller receives', () => {
        const error = raised(() => assert(false, 'User with id 1 not found', NotFoundException));

        nodeAssert.strictEqual(error instanceof NotFoundException, true);
        nodeAssert.strictEqual(error instanceof AssertionError, false);
        nodeAssert.strictEqual(error.name, 'NotFoundException');
    });

    test('the message is what the supplied constructor is given', () => {
        const error = raised(() => assert(false, 'User with id 1 not found', NotFoundException));

        nodeAssert.strictEqual(error.message, 'User with id 1 not found');
    });

    test('an omitted message with a supplied constructor still uses the default text', () => {
        const error = raised(() => assert(false, undefined, NotFoundException));

        nodeAssert.strictEqual(error.message, 'Assertion Error');
    });

    test('`Error` itself is accepted, since only a message is passed', () => {
        const error = raised(() => assert(false, 'no', Error));

        nodeAssert.strictEqual(error instanceof Error, true);
        nodeAssert.strictEqual(error.constructor, Error);
    });

    test('a bound constructor is accepted, since it keeps a construct signature', () => {
        class Coded extends Error {
            override name = 'Coded';
        }

        const Bound = Coded.bind(null) as new (message: string) => Error,
            error = raised(() => assert(false, 'no', Bound));

        nodeAssert.strictEqual(error instanceof Coded, true);
        nodeAssert.strictEqual(error.message, 'no');
    });

    test('a satisfied condition constructs nothing and returns `undefined`', () => {
        let constructed = 0;

        class Counted extends Error {
            constructor(message: string) {
                super(message);
                constructed++;
            }
        }

        nodeAssert.strictEqual(assert(true, 'unused', Counted), undefined);
        nodeAssert.strictEqual(constructed, 0, 'the error is built only on failure');
    });

    test('the condition is tested by truthiness, not by strict `true`', () => {
        nodeAssert.doesNotThrow(() => assert(1, 'no', NotFoundException));
        nodeAssert.doesNotThrow(() => assert('x', 'no', NotFoundException));
        nodeAssert.strictEqual(raised(() => assert(0, 'no', NotFoundException)).message, 'no');
        nodeAssert.strictEqual(raised(() => assert('', 'no', NotFoundException)).message, 'no');
    });

    test('a non-constructible value raises the `TypeError` that `new` raises', () => {
        /*
         * The type system refuses a call signature, so this is reached only from a
         * caller that defeated the types — plain JavaScript, or a cast. The error
         * documented for that path is `new`'s own, not a fabricated one.
         */
        type Built = new (message: string) => Error;

        const notAConstructor = (((message: string) => new NotFoundException(message)) as unknown) as Built;

        nodeAssert.throws(() => assert(false, 'no', notAConstructor), TypeError);
    });
});

describe('`assert` narrows across all three parameters', () => {
    test('the value is readable after the call, with a supplied error type', () => {
        type User = { name: string };

        const find = (id: number): User | undefined => id === 1 ? { name: 'ada' } : undefined,
            user = find(1);

        assert(user, 'User with id 1 not found', NotFoundException);

        // `user` is `User` here; without the assertion this is TS18048.
        nodeAssert.strictEqual(user.name, 'ada');
    });
});

/**
 * The third parameter admits only a construct signature, which is what makes it a
 * constructor rather than a factory. `npm run typecheck` reads these; a
 * `@ts-expect-error` that no longer has an error fails it.
 */
const typeSurface = (condition: () => boolean): void => {
    class WithRequiredCode extends Error {
        constructor(message: string, readonly code: string) { super(message); }
    }

    const factory = (message: string): Error => new NotFoundException(message);

    // A constructor that needs an argument nothing supplies cannot be used.
    // @ts-expect-error : a second required argument has no value here
    assert(condition(), 'no', WithRequiredCode);

    // A call signature is not a construct signature; `new` is what runs.
    // @ts-expect-error : a factory is called, not constructed
    assert(condition(), 'no', factory);
};

describe('The accepted error parameter is a constructor', () => {
    test('a constructor with an optional second argument is accepted', () => {
        class WithOptionalCode extends Error {
            constructor(message: string, readonly code?: string) { super(message); }
        }

        const error = raised(() => assert(false, 'no', WithOptionalCode));

        nodeAssert.strictEqual(error instanceof WithOptionalCode, true);
        nodeAssert.strictEqual(error.code, undefined, 'nothing supplied the optional argument');
    });

    test('the rejected forms stay rejected', () => {
        // `typeSurface` above carries the compile-time half of this contract; this
        // asserts the helper still exists so the directives are not orphaned.
        nodeAssert.strictEqual(typeof typeSurface, 'function');
    });
});
