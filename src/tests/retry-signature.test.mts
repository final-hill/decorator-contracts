import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, rescue } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/292
 *
 * These lock in the `retry` signature. Before `RescueHandler` declared
 * `retry` with `this: This`, every handler written outside the library failed
 * to type-check, because a bare call `retry(x)` has a `this` of `void`.
 *
 * The signatures below are the ones a consumer writes. If they stop compiling,
 * `npm run typecheck` fails.
 */
describe('`retry` is callable as a plain function', () => {
    test('a handler may call retry with arguments', () => {
        class Foo extends Contracted {
            protected _attempts = 0;

            @rescue((_self, _error, args, retry) => retry(...args))
            run(value: number): number {
                if (this._attempts++ === 0) throw new Error('first');

                return value;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).run(7), 7);
    });

    test('a handler may call retry with no arguments', () => {
        class Foo extends Contracted {
            protected _attempts = 0;

            @rescue((_self, _error, _args, retry) => retry())
            run(): number {
                if (this._attempts++ === 0) throw new Error('first');

                return 42;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).run(), 42);
    });

    test('a handler may declare retry with an explicit argument list', () => {
        class Foo extends Contracted {
            protected _attempts = 0;

            @rescue((_self, _error, _args, retry: (value: number) => void) => retry(0))
            run(): number {
                if (this._attempts++ === 0) throw new Error('first');

                return 0;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).run(), 0);
    });
});
