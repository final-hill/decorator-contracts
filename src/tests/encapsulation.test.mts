import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/305
 *
 * Feature bodies run with `this` bound to the proxy, so encapsulation is
 * enforced from inside a feature and not only from outside. A nested access
 * does not start a second lifecycle, because the enclosing invocation already
 * owns the assertions.
 */
describe('Encapsulation is enforced inside a feature body', () => {
    test('a method body cannot assign to a public property', () => {
        class Foo extends Contracted {
            publicProp = 1;

            @demands(() => true)
            write(): void { (this as any).publicProp = 2; }
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => foo.write(), TypeError);
        nodeAssert.strictEqual(foo.publicProp, 1);
    });

    test('a getter body cannot assign to a public property', () => {
        class Foo extends Contracted {
            publicProp = 1;

            get value(): number { (this as any).publicProp = 2; return 0; }
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => void foo.value, TypeError);
        nodeAssert.strictEqual(foo.publicProp, 1);
    });

    test('a setter body cannot assign to a public property', () => {
        class Foo extends Contracted {
            publicProp = 1;
            protected _value = 0;

            get value() { return this._value; }
            set value(v: number) { (this as any).publicProp = 2; this._value = v; }
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => { foo.value = 1; }, TypeError);
        nodeAssert.strictEqual(foo.publicProp, 1);
    });

    test('a feature body may still assign to an `_`-prefixed field', () => {
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }

            @demands(() => true)
            bump(): void { this._value += 1; }
        }

        const foo = Foo.new() as any;
        foo.bump();

        nodeAssert.strictEqual(foo.value, 1);
    });

    test('encapsulation is restored after a feature body throws', () => {
        class Foo extends Contracted {
            publicProp = 1;

            @demands(() => true)
            boom(): void { throw new Error('boom'); }
        }

        const foo = Foo.new() as any;
        nodeAssert.throws(() => foo.boom(), /boom/);

        nodeAssert.throws(() => { foo.publicProp = 2; }, TypeError);
        nodeAssert.strictEqual(foo.publicProp, 1);
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
