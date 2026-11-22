import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/340
 *
 * Decorator syntax reaches no released runtime, so every consumer transforms it.
 * The library implements the TC39 protocol, in which a decorator is called as
 * `(value, context)`.
 *
 * A build that emits the pre-standard protocol instead — which
 * `experimentalDecorators: true` selects — hands the decorators a property key or
 * the class itself. Every assertion that follows then describes the wrong
 * problem: a member decorator reports that the method it was applied to is not a
 * method, and `@invariant` destructures `undefined`. These pin the diagnostic
 * that names the actual cause, and the member-kind diagnostics it must not
 * displace.
 */

/**
 * A standard decorator context.
 *
 * The diagnostics are a pure function of the second argument, so a literal
 * context exercises them without a compiler in the loop.
 */
const context = (overrides: Record<string, unknown> = {}): any => ({
    kind: 'method',
    name: 'feature',
    static: false,
    private: false,
    metadata: {},
    access: {},
    addInitializer: () => { },
    ...overrides,
});

describe('An invocation without a decorator context names the cause', () => {
    /*
     * The pre-standard protocol passes the member's key as the second argument,
     * and calls a class decorator with the class alone. Neither supplies a
     * `kind`.
     */
    const legacyMember = 'feature' as any,
        legacyClass: any = undefined;

    test('a member decorator reports the protocol, not the member kind', () => {
        nodeAssert.throws(
            () => demands(() => true)(() => { }, legacyMember),
            (error: any) => error.name === 'AssertionError'
                && /experimentalDecorators/.test(error.message)
                && !/can only be applied to methods/.test(error.message),
        );
    });

    test('`@invariant` reports the protocol rather than destructuring `undefined`', () => {
        class Foo extends Contracted { }

        nodeAssert.throws(
            () => invariant(() => true)(Foo as any, legacyClass),
            (error: any) => error.name === 'AssertionError'
                && /experimentalDecorators/.test(error.message)
                && !/can only be applied to classes/.test(error.message),
        );
    });

    test('the message names the setting and the required protocol', () => {
        nodeAssert.throws(
            () => demands(() => true)(() => { }, legacyMember),
            /experimentalDecorators[\s\S]*TC39 protocol/,
        );
    });

    /*
     * A `kind` that is present but is not a string is the only input that
     * distinguishes "the context is absent" from "the context is a standard
     * one". Without this case the guard could be weakened to a presence check
     * and every other assertion here would still pass.
     */
    test('a `kind` that is not a string is not a standard context', () => {
        nodeAssert.throws(
            () => demands(() => true)(() => { }, { kind: 42 } as any),
            (error: any) => /experimentalDecorators/.test(error.message)
                && !/can only be applied to methods/.test(error.message),
        );
    });
});

describe('A genuine member-kind mistake is still reported as one', () => {
    /*
     * The protocol check runs first, so it must not swallow the diagnostics it
     * was added ahead of. A standard context describing a field is a different
     * error with a different fix.
     */
    test('`@demands` on a field reports the member kind', () => {
        nodeAssert.throws(
            () => demands(() => true)(undefined, context({ kind: 'field' })),
            (error: any) => /can only be applied to methods, getters, or setters/.test(error.message)
                && !/experimentalDecorators/.test(error.message),
        );
    });

    test('`@invariant` on a member reports the member kind', () => {
        class Foo extends Contracted { }

        nodeAssert.throws(
            () => invariant(() => true)(Foo as any, context({ kind: 'method' })),
            /can only be applied to classes/,
        );
    });

    test('a standard context is accepted', () => {
        // No throw: `void` is the correct return for a member decorator.
        nodeAssert.doesNotThrow(() => demands(() => true)(() => { }, context()));
    });
});
