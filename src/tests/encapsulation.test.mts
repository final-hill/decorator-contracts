import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/305
 *
 * Contracts describe the observable boundary of a feature, in the sense of a
 * Hoare triple `{ P } C { Q }`. `C` — the feature body — is unconstrained:
 * what it does to internal or even public state is irrelevant, because
 * correctness is the obligation that `P` and `Q` hold at the boundary.
 *
 * Encapsulation therefore governs the external surface only. It exists so a
 * caller cannot mutate state without a postcondition to catch it. Inside a
 * body, `@ensures` and `@invariant` provide that guarantee instead.
 */
describe('Encapsulation governs the external surface only', () => {
    test('an external caller cannot assign to a public property', () => {
        class Foo extends Contracted {
            publicProp = 1;
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => { foo.publicProp = 2; }, TypeError);
        nodeAssert.strictEqual(foo.publicProp, 1);
    });

    test('an external caller cannot add a public property', () => {
        class Foo extends Contracted { }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => { foo.injected = 1; }, TypeError);
    });

    test('a method body may assign to its own public property', () => {
        class Foo extends Contracted {
            publicProp = 1;

            @demands(() => true)
            write(): void { this.publicProp = 2; }
        }

        const foo = Foo.new() as any;
        foo.write();

        nodeAssert.strictEqual(foo.publicProp, 2);
    });

    test('a getter body may assign to its own public property', () => {
        class Foo extends Contracted {
            publicProp = 1;

            get value(): number { (this as any).publicProp = 2; return 0; }
        }

        const foo = Foo.new() as any;
        void foo.value;

        nodeAssert.strictEqual(foo.publicProp, 2);
    });

    test('a setter body may assign to its own public property', () => {
        class Foo extends Contracted {
            publicProp = 1;
            protected _value = 0;

            get value() { return this._value; }
            set value(v: number) { (this as any).publicProp = 2; this._value = v; }
        }

        const foo = Foo.new() as any;
        foo.value = 1;

        nodeAssert.strictEqual(foo.publicProp, 2);
    });

    test('a body leaving an invalid state is caught by the invariant', () => {
        @invariant((self: Foo) => self.publicProp === 1)
        class Foo extends Contracted {
            publicProp = 1;

            @demands(() => true)
            corrupt(): void { this.publicProp = 2; }
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => foo.corrupt(), /Invariant violated/);
    });

    test('a body producing the wrong result is caught by the postcondition', () => {
        class Counter extends Contracted {
            protected _n = 0;
            get n() { return this._n; }

            @ensures((self: Counter) => self.n === 2)
            @demands(() => true)
            inc(): void { this._n = this._n + 1; }
        }

        nodeAssert.throws(() => (Counter.new() as any).inc(), /No ensurances were satisfied/);
    });
});

describe('A nested feature access does not start a second lifecycle', () => {
    test('a method calling another method runs one lifecycle', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Foo extends Contracted {
            @demands(() => true)
            inner(): void { }

            @demands(() => true)
            outer(): void { this.inner(); }
        }

        const foo = Foo.new() as any;
        evaluations = 0;
        foo.outer();

        nodeAssert.strictEqual(evaluations, 2);
    });

    test('a getter reading another getter runs one lifecycle', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Foo extends Contracted {
            protected _value = 1;
            get inner() { return this._value; }
            get outer() { return this.inner; }
        }

        const foo = Foo.new() as any;
        evaluations = 0;
        void foo.outer;

        nodeAssert.strictEqual(evaluations, 2);
    });

    test('a setter calling a method runs one lifecycle', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this.assign(v); }

            @demands(() => true)
            assign(v: number): void { this._value = v; }
        }

        const foo = Foo.new() as any;
        evaluations = 0;
        foo.value = 1;

        nodeAssert.strictEqual(evaluations, 2);
        nodeAssert.strictEqual(foo.value, 1);
    });

    test('the outer postcondition is still evaluated', () => {
        let ensured = false;

        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }

            @ensures((self: Foo) => { ensured = self.value === 1; return ensured; })
            write(): void { this._value = 1; }
        }

        Foo.new().write();

        nodeAssert.strictEqual(ensured, true);
    });
});

describe('Re-entrancy state is per instance', () => {
    test('contracts remain enforced on a different instance during a lifecycle', () => {
        let otherEnforced = false;

        class Other extends Contracted {
            @ensures(() => false)
            bad(): void { }
        }

        class Foo extends Contracted {
            protected _other = Other.new();

            @demands(() => true)
            run(): void {
                try { (this as any)._other.bad(); }
                catch { otherEnforced = true; }
            }
        }

        Foo.new().run();

        nodeAssert.strictEqual(otherEnforced, true, 'a nested instance still enforces its contracts');
    });

    test('an unfinished lifecycle does not disable contracts globally', () => {
        class Foo extends Contracted {
            @demands(() => true)
            boom(): void { throw new Error('boom'); }
        }

        const foo = Foo.new();
        nodeAssert.throws(() => foo.boom(), /boom/);

        class Bar extends Contracted {
            @ensures(() => false)
            bad(): void { }
        }

        nodeAssert.throws(() => (Bar.new() as any).bad(), /No ensurances were satisfied/);
    });
});
