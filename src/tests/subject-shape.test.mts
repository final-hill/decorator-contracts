import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant, rescue, type EnsuresSubject } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/330
 *
 * Every contract calls its predicate with a **single object** rather than a
 * positional list. The shape is the published API, so it is asserted here rather
 * than left to the call sites that happen to destructure it: a test that reads
 * the subject from the first parameter would still pass for a predicate that
 * destructures `({ self })` out of the instance, and would silently receive
 * `undefined` only where it reads `args`.
 */
describe('A contract predicate is called with one subject object', () => {
    test('@demands receives exactly one argument', () => {
        let arity = -1;

        class Foo extends Contracted {
            public _n = 0;

            @demands(function (...received: any[]) {
                arity = received.length;

                return true;
            })
            method(): void { }
        }

        (Foo.new() as Foo).method();
        nodeAssert.strictEqual(arity, 1, 'the subject is one object, not a parameter list');
    });

    test('@demands supplies `self` and `args` and nothing else', () => {
        let keys: string[] = [];

        class Foo extends Contracted {
            public _n = 0;

            @demands((subject) => {
                keys = Object.keys(subject).sort();

                return true;
            })
            method(_a: number): void { }
        }

        (Foo.new() as Foo).method(1);
        nodeAssert.deepStrictEqual(keys, ['args', 'self']);
    });

    test('@invariant supplies `self` only', () => {
        let keys: string[] = [];
        let memberRead: unknown;

        @invariant((subject) => {
            keys = Object.keys(subject).sort();
            memberRead = (subject.self as { _n: number })._n;

            return true;
        })
        class Foo extends Contracted {
            public _n = 42;
        }

        Foo.new();

        nodeAssert.deepStrictEqual(keys, ['self']);
        nodeAssert.strictEqual(memberRead, 42, '`self` is the instance, not a placeholder');
    });

    test('@ensures supplies `self`, `args`, `old`, `oldArgs`, and `result`', () => {
        let keys: string[] = [];

        class Foo extends Contracted {
            public _n = 0;

            @ensures((subject) => {
                keys = Object.keys(subject).sort();

                return true;
            })
            method(): number { return 1; }
        }

        (Foo.new() as Foo).method();
        nodeAssert.deepStrictEqual(keys, ['args', 'old', 'oldArgs', 'result', 'self']);
    });

    test('@rescue supplies `self`, `error`, `args`, `retry`, and `feature`', () => {
        let keys: string[] = [];

        class Foo extends Contracted {
            @rescue((subject) => {
                keys = Object.keys(subject).sort();
            })
            method(): void { throw new Error('boom'); }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).method(), { message: 'boom' });
        nodeAssert.deepStrictEqual(keys, ['args', 'error', 'feature', 'retry', 'self']);
    });
});

/**
 * `EnsuresSubject`'s third type parameter names the result. It defaults to
 * `unknown`, so a predicate that compares the result says what it expects, and
 * naming it must not reject the declaration. Fixing the parameter at `unknown`
 * instead would make `EnsuresSubject<This, Args, number>` unassignable to the
 * decorator's own arm type, which is why the parameter is threaded through
 * `EnsuresPredicate` and `EnsuresArm`.
 */
describe('A postcondition may name the result type', () => {
    test('an annotated `result` is accepted and read at runtime', () => {
        let seen = -1;

        class Foo extends Contracted {
            @ensures(({ result }: EnsuresSubject<Foo, [], number>) => {
                seen = result;

                return result > 0;
            })
            method(): number { return 7; }
        }

        (Foo.new() as Foo).method();
        nodeAssert.strictEqual(seen, 7);
    });
});

/**
 * `args` is the invocation's argument list, which is the same tuple the schema
 * arm validates. Keeping one subject for both kinds of arm is what lets the
 * composition rule be the same for both.
 */
describe('The subject carries the invocation', () => {
    test('@demands `args` is the argument list', () => {
        let seen: unknown;

        class Foo extends Contracted {
            @demands(({ args }) => {
                seen = args;

                return true;
            })
            method(_a: number, _b: string): void { }
        }

        (Foo.new() as Foo).method(1, 'x');
        nodeAssert.deepStrictEqual(seen, [1, 'x']);
    });

    test('@ensures `old` is the instance from before the feature ran', () => {
        let grew = false;

        class Counter extends Contracted {
            public _n = 0;

            @ensures(({ self, old }) => {
                grew = self._n === old._n + 1;

                return true;
            })
            inc(): void { this._n++; }
        }

        (Counter.new() as Counter).inc();
        nodeAssert.strictEqual(grew, true);
    });

    test('@rescue `error` is the value the body threw', () => {
        let caught: unknown;

        class Foo extends Contracted {
            @rescue(({ error }) => { caught = error; })
            method(): void { throw new Error('boom'); }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).method());
        nodeAssert.strictEqual((caught as Error).message, 'boom');
    });
});
