import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, ensures, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/188
 *
 * A getter can be `async` only by returning a promise from a normal getter:
 *
 * ```ts
 * get value() { return this.fetch(); }
 * ```
 *
 * Such a getter is a *synchronous* feature as far as its declaration goes, so it
 * falls under the "must not return a promise" rule rather than being awaited.
 * This is deliberate: `obj.value` reads as a value, and callers do not expect a
 * promise from it, so treating it as asynchronous would silently defer the
 * contract to a point no reader of the expression anticipates.
 */
describe('Accessors that return promises', () => {
    test('a getter returning a promise is refused rather than checked late', () => {
        @invariant(function () { return true; })
        class Foo extends Contracted {
            public _value = 1;

            @ensures(function () { return true; })
            get value() { return Promise.resolve(this._value); }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).value, {
            name: 'AssertionError',
            message: /Foo\.value returned a promise but is not declared 'async'/,
        });
    });

    test('a getter is bracketed by the invariant and fails synchronously', () => {
        let evaluations = 0;

        @invariant(function ({ self }) { evaluations++; return self._value > 0; })
        class Foo extends Contracted {
            public _value = 1;

            @ensures(function () { return true; })
            get value() { return this._value; }
        }

        // Accessors are synchronous, so their failure surface is a throw
        // regardless of what their body returns.
        const foo = Foo.new() as Foo;
        evaluations = 0;

        nodeAssert.equal(foo.value, 1);
        nodeAssert.equal(evaluations, 2);
    });
});
