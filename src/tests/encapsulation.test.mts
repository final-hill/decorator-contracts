import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { checkedMode, Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';

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

        nodeAssert.throws(() => foo.corrupt(), /@invariant failed/);
    });

    test('a body producing the wrong result is caught by the postcondition', () => {
        class Counter extends Contracted {
            protected _n = 0;
            get n() { return this._n; }

            @ensures((self: Counter) => self.n === 2)
            @demands(() => true)
            inc(): void { this._n = this._n + 1; }
        }

        nodeAssert.throws(() => (Counter.new() as any).inc(), /@ensures failed/);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/338
 *
 * Encapsulation is a statement about the instance's external surface, so it has
 * to hold for every operation that mutates that surface, not only for `=` and
 * `delete`. Definition is also the only route that can replace a public field or
 * a contracted method outright, which defeats every contract on the instance
 * rather than escaping one.
 */
describe('Encapsulation covers property definition', () => {
    test('an external caller cannot redefine a public property', () => {
        class Foo extends Contracted {
            publicProp = 1;
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(
            () => Object.defineProperty(foo, 'publicProp', { value: 2, writable: true, configurable: true }),
            TypeError,
        );
        nodeAssert.strictEqual(foo.publicProp, 1);
    });

    test('Reflect.defineProperty is refused too', () => {
        class Foo extends Contracted {
            publicProp = 1;
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => Reflect.defineProperty(foo, 'publicProp', { value: 2 }), TypeError);
        nodeAssert.strictEqual(foo.publicProp, 1);
    });

    test('an external caller cannot replace a contracted method', () => {
        class Foo extends Contracted {
            @demands((_self: Foo, [n]: [number]) => n > 0)
            guarded(n: number): number { return n; }
        }

        const foo = Foo.new() as any;

        // Replacing the method would route callers around `@demands` entirely.
        nodeAssert.throws(() => Object.defineProperty(foo, 'guarded', { value: () => 'replaced' }), TypeError);
        nodeAssert.strictEqual(foo.guarded(1), 1);
        nodeAssert.throws(() => foo.guarded(-1), /@demands failed/);
    });

    test('an external caller can define an `_`-prefixed property', () => {
        class Foo extends Contracted {
            public _value = 1;
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(
            () => Object.defineProperty(foo, '_added', { value: 2, writable: true, configurable: true, enumerable: true }),
        );
        nodeAssert.strictEqual(foo._added, 2);
    });

    test('a prototype setter does not authorise defining the same name', () => {
        class Foo extends Contracted {
            public _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }
        }

        const foo = Foo.new() as any;

        // Assignment invokes the setter, which is the sanctioned route. Defining
        // an own property of the same name would shadow the accessor instead, so
        // it is not an equivalent operation and is refused.
        nodeAssert.doesNotThrow(() => { foo.value = 3; });
        nodeAssert.strictEqual(foo.value, 3);
        nodeAssert.throws(() => Object.defineProperty(foo, 'value', { value: 99 }), TypeError);
        nodeAssert.strictEqual(foo.value, 3);
    });

    test('a feature body may still define its own state', () => {
        class Foo extends Contracted {
            public _value = 1;

            @demands(() => true)
            define(): void {
                Object.defineProperty(this, '_value', { value: 2, writable: true, configurable: true });
            }
        }

        const foo = Foo.new() as any;
        foo.define();

        nodeAssert.strictEqual(foo._value, 2);
    });

    test('definition is unrestricted when checked mode is disabled', () => {
        class Foo extends Contracted {
            publicProp = 1;
        }

        const foo = Foo.new() as any;
        Contracted[checkedMode] = false;

        try {
            nodeAssert.doesNotThrow(() => Object.defineProperty(foo, 'publicProp', { value: 2 }));
            nodeAssert.strictEqual(foo.publicProp, 2);
        }
        finally {
            Contracted[checkedMode] = true;
        }
    });
});

describe('The prototype of an instance cannot be replaced', () => {
    test('Object.setPrototypeOf is refused', () => {
        class Foo extends Contracted {
            publicProp = 1;
        }

        nodeAssert.throws(() => Object.setPrototypeOf(Foo.new(), {}), TypeError);
    });

    test('Reflect.setPrototypeOf is refused too', () => {
        class Foo extends Contracted {
            publicProp = 1;
        }

        nodeAssert.throws(() => Reflect.setPrototypeOf(Foo.new(), {}), TypeError);
    });

    test('the instance keeps its features and contracts after a refused replacement', () => {
        class Foo extends Contracted {
            @demands((_self: Foo, [n]: [number]) => n > 0)
            guarded(n: number): number { return n; }
        }

        const foo = Foo.new();
        nodeAssert.throws(() => Object.setPrototypeOf(foo, {}), TypeError);

        nodeAssert.strictEqual(foo.guarded(1), 1);
        nodeAssert.throws(() => foo.guarded(-1), /@demands failed/);
        nodeAssert.ok(foo instanceof Foo);
    });

    test('a replacement is permitted when checked mode is disabled', () => {
        class Foo extends Contracted {
            publicProp = 1;
        }

        const foo = Foo.new();
        Contracted[checkedMode] = false;

        try {
            nodeAssert.doesNotThrow(() => Object.setPrototypeOf(foo, {}));
        }
        finally {
            Contracted[checkedMode] = true;
        }
    });
});

describe('A frozen instance reports failed writes', () => {
    test('a write to a frozen instance throws instead of being swallowed', () => {
        class Foo extends Contracted {
            public _value = 1;
        }

        const foo = Foo.new() as any;
        Object.freeze(foo);

        // Reporting success for a write the target rejected would leave the
        // caller believing state changed when it did not.
        nodeAssert.throws(() => { foo._value = 2; }, TypeError);
        nodeAssert.strictEqual(foo._value, 1);
    });

    test('a frozen instance still runs its features', () => {
        class Foo extends Contracted {
            public _value = 1;
            @demands((_self: Foo, [n]: [number]) => n > 0)
            read(n: number): number { return this._value + n; }
        }

        const foo = Foo.new() as any;
        Object.freeze(foo);

        nodeAssert.strictEqual(foo.read(2), 3);
        nodeAssert.throws(() => foo.read(-1), /@demands failed/);
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

        nodeAssert.throws(() => (Bar.new() as any).bad(), /@ensures failed/);
    });
});
