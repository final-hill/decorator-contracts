import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { checkedMode, Contracted, demands, ensures, invariant, rescue } from '@final-hill/decorator-contracts';

/**
 * Contracts are `{ P } C { Q }`: `P` and `Q` are predicates evaluated against
 * the instance. Reading instance state from a predicate must not re-enter the
 * traps, otherwise evaluating a contract would itself trigger a contract.
 *
 * The re-entrancy guards were removed on the basis that bodies and predicates
 * receive the raw target, so no trap is re-entered. These tests pin that.
 */
describe('Contract evaluation does not re-enter the traps', () => {
    test('a predicate reading a getter', () => {
        let evaluations = 0;

        @invariant(({ self }) => { evaluations++; return self.value >= 0; })
        class Foo extends Contracted {
            protected _value = 1;
            get value() { return this._value; }

            @demands(({ self }) => self.value >= 0)
            @ensures(({ self, old  }) => self.value === old.value + 1)
            @demands(() => true)
            inc(): void { this._value += 1; }
        }

        const foo = Foo.new() as any;
        evaluations = 0;

        nodeAssert.doesNotThrow(() => foo.inc());
        nodeAssert.strictEqual(evaluations, 2);
    });

    test('a predicate calling a method on the instance', () => {
        @invariant(({ self }) => self.check())
        class Foo extends Contracted {
            protected _n = 0;
            get n() { return this._n; }

            check(): boolean { return this._n >= 0; }

            @demands(() => true)
            bump(): void { this._n += 1; }
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(() => foo.bump());
        nodeAssert.strictEqual(foo.n, 1);
    });

    test('a predicate reading a property through a chain of getters', () => {
        @invariant(({ self }) => self.outer >= 0)
        class Foo extends Contracted {
            protected _v = 1;
            get inner() { return this._v; }
            get outer() { return this.inner; }

            @demands(() => true)
            inc(): void { this._v += 1; }
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(() => foo.inc());
    });

    test('a rescue handler reading instance state', () => {
        class Foo extends Contracted {
            protected _attempts = 0;
            get attempts() { return this._attempts; }

            @demands(() => true)
            @rescue(({ self, retry }) => {
                self._attempts++;
                retry();
            })
            run(): number {
                if (this._attempts === 0) throw new Error('first');
                return 42;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).run(), 42);
    });
});

describe('Checked mode remains the global on/off switch', () => {
    test('disabling checked mode stops a failing postcondition from raising', () => {
        class Foo extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        const foo = Foo.new() as any;
        Contracted[checkedMode] = false;

        try {
            nodeAssert.doesNotThrow(() => foo.method());
        } finally {
            Contracted[checkedMode] = true;
        }

        nodeAssert.throws(() => foo.method(), /@ensures failed/);
    });

    test('disabling checked mode permits external writes', () => {
        class Foo extends Contracted {
            publicProp = 1;
        }

        const foo = Foo.new() as any;
        Contracted[checkedMode] = false;

        try {
            nodeAssert.doesNotThrow(() => { foo.publicProp = 2; });
        } finally {
            Contracted[checkedMode] = true;
        }

        nodeAssert.throws(() => { foo.publicProp = 3; }, TypeError);
    });

    test('checked mode is unaffected by a predicate that throws', () => {
        class Foo extends Contracted {
            @demands(() => { throw new Error('predicate boom'); })
            method(): void { }
        }

        const foo = Foo.new() as any;
        nodeAssert.throws(() => foo.method(), /predicate boom/);

        nodeAssert.strictEqual(Contracted[checkedMode], true);
    });
});
