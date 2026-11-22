import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, Contracted, demands, ensures, type DemandsSubject, type EnsuresSubject } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/290
 *
 * These mirror the README's subtyping examples. They exist so the documented
 * signatures are executable: a predicate is called with one subject object, so
 * it destructures `({ args: [x] })` rather than taking the first argument
 * directly.
 *
 * The incorrect forms compile when the predicate reads the parameter list as
 * though it were the first argument: `({ args }) => args >= 0` compares the
 * array rather than its element. Comparison then passes through coercion
 * (`[5] >= 0` is `true`) until the argument is non-numeric, at which point the
 * contract silently fails.
 */
describe('README subtyping examples', () => {
    class BaseD extends Contracted {
        @demands(({ args: [x] }: DemandsSubject<Contracted, [number]>) => x >= 0)
        foo(x: number): number { return x; }
    }

    class SubD extends BaseD {
        @demands(({ args: [x] }: DemandsSubject<Contracted, [number]>) => x === 42)
        override foo(x: number): number { return x; }
    }

    test('demands are OR-ed: either arm satisfies the precondition', () => {
        const sub = SubD.new();

        nodeAssert.strictEqual(sub.foo(1), 1, 'base arm');
        nodeAssert.strictEqual(sub.foo(42), 42, 'sub arm');
        nodeAssert.strictEqual(sub.foo(0), 0, 'base arm: 0 >= 0');
        nodeAssert.strictEqual(sub.foo(41), 41, 'base arm: 41 >= 0');
        nodeAssert.throws(() => sub.foo(-1), AssertionError, 'neither arm');
    });

    class BaseE extends Contracted {
        @ensures(({ args: [x] }: EnsuresSubject<Contracted, [number], unknown>) => x >= 0)
        foo(x: number): number { return x; }
    }

    class SubE extends BaseE {
        @ensures(({ args: [x] }: EnsuresSubject<Contracted, [number], unknown>) => x <= 10)
        override foo(x: number): number { return x; }
    }

    test('ensures are AND-ed: every arm must hold', () => {
        const sub = SubE.new();

        nodeAssert.strictEqual(sub.foo(5), 5);
        nodeAssert.strictEqual(sub.foo(10), 10);
        nodeAssert.throws(() => sub.foo(11), AssertionError, 'violates the subclass arm');
        nodeAssert.throws(() => sub.foo(-1), AssertionError, 'violates the base arm');
    });
});

describe('A predicate receives the argument list', () => {
    test('the `args` field is the array of arguments', () => {
        let received: unknown;

        class Foo extends Contracted {
            @demands(({ args }) => { received = args; return true; })
            method(_a: number, _b: string): void { }
        }

        Foo.new().method(1, 'x');

        nodeAssert.deepStrictEqual(received, [1, 'x']);
    });

    test('destructuring reads individual arguments', () => {
        class Foo extends Contracted {
            @demands(({ args: [a, b] }: DemandsSubject<Contracted, [number, string]>) => a > 0 && b.length > 0)
            method(_a: number, _b: string): void { }
        }

        const foo = Foo.new();

        nodeAssert.doesNotThrow(() => foo.method(1, 'x'));
        nodeAssert.throws(() => foo.method(0, 'x'), AssertionError);
        nodeAssert.throws(() => foo.method(1, ''), AssertionError);
    });

    test('an `@ensures` predicate also receives the argument list, plus `old`', () => {
        let argsSeen: unknown;
        let oldSeen: boolean | undefined;

        class Counter extends Contracted {
            protected _n = 0;
            get n() { return this._n; }

            @ensures(({ self, args, old }) => {
                argsSeen = args;
                oldSeen = self.n === old.n + args[0];
                return true;
            })
            inc(by: number): void { this._n += by; }
        }

        Counter.new().inc(2);

        nodeAssert.deepStrictEqual(argsSeen, [2]);
        nodeAssert.strictEqual(oldSeen, true);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/332
 *
 * Mirrors the README's "a predicate that throws is a failed predicate" example, so
 * the documented behaviour is executable.
 */
describe('README: a throwing predicate is a failed predicate', () => {
    class Denied extends Error {
        override name = 'Denied';
    }

    class BaseThrows extends Contracted {
        @demands(({ args: [x] }: DemandsSubject<BaseThrows, [number]>) => { if (x !== 42) throw new Denied(); return true; })
        method(x: number): number { return x; }
    }

    class SubThrows extends BaseThrows {
        @demands(({ args: [x] }: DemandsSubject<SubThrows, [number]>) => x === 7)
        override method(x: number): number { return x; }
    }

    test('the weakening arm permits a call the throwing arm would have denied', () => {
        nodeAssert.strictEqual(SubThrows.new().method(7), 7);
    });

    test('an all-arms-failed call raises the typed error with the violation attached', () => {
        try {
            SubThrows.new().method(1);
            nodeAssert.fail('expected the arms to reject');
        } catch (caught) {
            const error = caught as any;

            nodeAssert.strictEqual(error instanceof Denied, true);
            nodeAssert.strictEqual(error.violation.contract, '@demands');
            nodeAssert.deepStrictEqual(error.violation.thrownIndices, [0]);
        }
    });
});
