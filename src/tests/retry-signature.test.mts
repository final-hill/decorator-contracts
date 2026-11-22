import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, rescue, type RescueSubject } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/292
 *
 * These lock in the `retry` signature. `retry` is a field of the rescue subject
 * rather than a method of it, so it is called bare, `retry(x)`, and its `this` is
 * `void`. Declaring `this: This` on the handler makes every consumer-written
 * handler fail to type-check for that reason.
 *
 * The signatures below are the ones a consumer writes. If they stop compiling,
 * `npm run typecheck` fails.
 */
describe('`retry` is callable as a plain function', () => {
    test('a handler may call retry with arguments', () => {
        class Foo extends Contracted {
            protected _attempts = 0;

            @rescue(({ args, retry }) => retry(...args))
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

            @rescue(({ retry }) => retry())
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

            @rescue(({ retry }) => retry(0))
            run(): number {
                if (this._attempts++ === 0) throw new Error('first');

                return 0;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).run(), 0);
    });
});

/**
 * A handler written as a `function` expression gets the instance as its `this`,
 * because the runtime invokes it with `Function.prototype.call`. An arrow
 * handler ignores that, which is why the instance is also supplied as `self`.
 */
describe('A `function` handler receives the instance as `this`', () => {
    test('`this` and `self` are the same instance', () => {
        const observed: { viaThis?: number, viaSelf?: number } = {};

        class Foo extends Contracted {
            public _n = 7;

            @rescue(function (this: Foo, { self }: RescueSubject<Foo>) {
                observed.viaThis = this._n;
                observed.viaSelf = self._n;
            })
            run(): void { throw new Error('boom'); }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).run(), { message: 'boom' });
        nodeAssert.strictEqual(observed.viaThis, 7, '`this` is the instance');
        nodeAssert.strictEqual(observed.viaSelf, 7, '`self` is the instance too');
    });
});
