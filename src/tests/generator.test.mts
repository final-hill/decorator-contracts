import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant, rescue } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/318
 *
 * The contract lifecycle runs around the creation of a generator's iterator, not
 * around the execution of its body: `Reflect.apply` returns an iterator before
 * the body has run. A postcondition is therefore evaluated against a body that
 * has not executed, which both rejects correct features and passes incorrect
 * ones.
 *
 * Until the boundary semantics for generators are decided, the decorators reject
 * generator features rather than silently enforcing nothing.
 */
describe('Generator features are rejected until their boundary is decided', () => {
    test('`@demands` refuses a generator method', () => {
        nodeAssert.throws(() => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                @demands(function () { return true; })
                *gen(): Generator<number> { yield 1; }
            }

            void Foo;
        }, { name: 'AssertionError', message: /@demands cannot be applied to a generator feature/ });
    });

    test('`@ensures` refuses a generator method', () => {
        nodeAssert.throws(() => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                @ensures(function () { return true; })
                *gen(): Generator<number> { yield 1; }
            }

            void Foo;
        }, { name: 'AssertionError', message: /@ensures cannot be applied to a generator feature/ });
    });

    test('`@rescue` refuses a generator method', () => {
        nodeAssert.throws(() => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                @rescue(function () { })
                *gen(): Generator<number> { yield 1; }
            }

            void Foo;
        }, { name: 'AssertionError', message: /@rescue cannot be applied to a generator feature/ });
    });

    test('an async generator is refused too', () => {
        nodeAssert.throws(() => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                @ensures(function () { return true; })
                async *gen(): AsyncGenerator<string> { yield 'a'; }
            }

            void Foo;
        }, { name: 'AssertionError', message: /@ensures cannot be applied to a generator feature/ });
    });

    test('a generator without contract decorators is refused at call time', () => {
        @invariant(function () { return true; })
        class Foo extends Contracted {
            *gen(): Generator<number> { yield 1; }
        }

        const foo = Foo.new() as Foo;

        // Refusing only in the decorators would leave a bare generator looking
        // checked when the invariant is in fact never evaluated during iteration.
        nodeAssert.throws(() => foo.gen(), {
            name: 'TypeError',
            message: /Foo\.gen is a generator, and the contract boundary .* is not supported yet/,
        });
    });

    test('an async generator without contract decorators is refused at call time', () => {
        @invariant(function () { return true; })
        class Foo extends Contracted {
            async *gen(): AsyncGenerator<number> { yield 1; }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).gen(), {
            name: 'TypeError',
            message: /is a generator/,
        });
    });

    test('ordinary methods on the same class still work', () => {
        @invariant(function () { return true; })
        class Foo extends Contracted {
            *gen(): Generator<number> { yield 1; }

            @ensures(function () { return true; })
            plain(): number { return 1; }
        }

        nodeAssert.equal((Foo.new() as Foo).plain(), 1);
    });
});
