import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { checkedMode, Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/366
 *
 * The `get` trap resolves a member from the instance's prototype chain and wraps
 * a feature so its lifecycle can run. An **own** property must be found first:
 * that is what JavaScript's own lookup order does, and it is the only way a
 * field, or a property a body assigned, can shadow a prototype member.
 *
 * A read that consults only the chain cannot see the own property, so it reports the
 * prototype member in its place: a silent wrong value rather than a contract
 * failure.
 */
describe('An own property shadows a prototype member', () => {
    test('a field shadows an inherited getter of the same name', () => {
        class Base extends Contracted {
            _n = 7;
            get count(): number { return this._n; }
        }

        // The field is installed as own state rather than declared, because a
        // declaration that shadows an inherited accessor is a TypeScript error
        // (TS2610) while being exactly what the emitted JavaScript does. The runtime
        // must agree with the language: an own property is found before the chain.
        class Derived extends Base {
            constructor() {
                super();

                Object.defineProperty(this, 'count', {
                    value: 99, writable: true, enumerable: true, configurable: true,
                });
            }
        }

        const derived: any = Derived.new();

        nodeAssert.strictEqual(
            derived.count,
            99,
            'the own field is the value an external reader sees',
        );
    });

    test('a field shadows a prototype method of the same name', () => {
        class Base extends Contracted {
            read(): string { return 'method'; }
        }

        class Derived extends Base {
            constructor() {
                super();

                Object.defineProperty(this, 'read', {
                    value: 'field', writable: true, enumerable: true, configurable: true,
                });
            }
        }

        const derived: any = Derived.new();

        nodeAssert.strictEqual(derived.read, 'field');
    });

    test('a body assigning an own property shadows the prototype method it names', () => {
        class Foo extends Contracted {
            @demands(() => true)
            replace(): void {
                // A body runs on the raw target, so this is an own property that no
                // trap sees. What an external reader gets afterwards must be it.
                (this as any).feature = 'replaced';
            }

            feature(): string { return 'method'; }
        }

        const foo = Foo.new() as any;

        nodeAssert.strictEqual(foo.feature(), 'method');

        foo.replace();

        nodeAssert.strictEqual(foo.feature, 'replaced');
    });

    test('removing the own property restores the prototype member', () => {
        class Foo extends Contracted {
            @demands(() => true)
            replace(): void { (this as any).feature = 'replaced'; }
            remove(): void { delete (this as any).feature; }

            feature(): string { return 'method'; }
        }

        const foo = Foo.new() as any;

        foo.replace();
        nodeAssert.strictEqual(foo.feature, 'replaced');

        foo.remove();
        nodeAssert.strictEqual(typeof foo.feature, 'function');
        nodeAssert.strictEqual(foo.feature(), 'method');
    });

    test('an own `_`-prefixed data property is read without a lifecycle', () => {
        let evaluations = 0;

        class Foo extends Contracted {
            _v = 1;
            get watched(): number { evaluations++; return this._v; }
        }

        const foo = Foo.new() as any,
            base = evaluations;

        nodeAssert.strictEqual(foo._v, 1);
        nodeAssert.strictEqual(evaluations, base, 'reading own state is not a feature invocation');
    });
});

/**
 * A member that is not a function is returned as it is, which is also what makes
 * the own-property rule safe: an own data property never acquires a lifecycle.
 */
describe('An own data property is not wrapped', () => {
    test('a method-named own string is returned verbatim', () => {
        class Foo extends Contracted {
            @demands(() => true)
            shadow(): void { (this as any).guarded = 'not-a-function'; }
            guarded(): string { return 'method'; }
        }

        const foo = Foo.new() as any;

        foo.shadow();

        nodeAssert.strictEqual(typeof foo.guarded, 'string');
        nodeAssert.strictEqual(foo.guarded, 'not-a-function');
    });

    test('a contracted own property cannot be created by an external caller', () => {
        // The encapsulation rule is unchanged: an external definition of a public
        // name is refused, so an own property can only appear via a body or an
        // initializer.
        class Foo extends Contracted {
            guarded(): string { return 'method'; }
        }

        nodeAssert.throws(
            () => Object.defineProperty(Foo.new(), 'guarded', { value: 'injected' }),
            TypeError,
        );
    });
});

/**
 * An own **function** is state, not a declared feature. A decorator refuses a
 * private name, so every contracted member's descriptor stays on the prototype and
 * an own function can only be a callback a body assigned. Returning it as the trap
 * found it is what keeps the `get` invariant, the callback's own `this`, and the
 * identity a caller compares against.
 */
describe('An own function-valued property is returned as it is', () => {
    test('reading a frozen instance does not throw', () => {
        class Foo extends Contracted {
            _v = 0;
        }

        const foo = Foo.new() as any;

        foo._cb = () => 'called';
        Object.freeze(foo);

        // The trap must return the property's actual value when the descriptor is a
        // read-only, non-configurable data property, or the proxy invariant throws.
        nodeAssert.strictEqual(typeof foo._cb, 'function');
        nodeAssert.strictEqual(foo._cb(), 'called');
    });

    test('a sealed instance reads its own callback', () => {
        class Foo extends Contracted {
            _v = 0;
        }

        const foo = Foo.new() as any;

        foo._cb = () => 'called';
        Object.seal(foo);

        nodeAssert.strictEqual(foo._cb(), 'called');
    });

    test('the callback keeps its identity and its raw receiver', () => {
        class Foo extends Contracted {
            _v = 0;
            install(): () => string {
                const callback = function (this: any) { return this === undefined ? 'no-this' : 'bound'; };

                (this as any)._cb = callback;

                return callback;
            }
        }

        const foo = Foo.new() as any,
            installed = foo.install();

        nodeAssert.strictEqual(foo._cb, installed, 'a read returns the function the body assigned');
    });

    test('calling an own callback does not run a contract', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Foo extends Contracted {
            _v = 0;
            install(): void { (this as any)._cb = () => 'called'; }
        }

        const foo = Foo.new() as any;

        foo.install();

        const base = evaluations;

        nodeAssert.strictEqual(foo._cb(), 'called');
        nodeAssert.strictEqual(evaluations, base, 'a callback is not a feature invocation');
    });

    test('a replaced callback is read, not the one seen first', () => {
        class Foo extends Contracted {
            _v = 0;
            install(value: string): void { (this as any)._cb = () => value; }
        }

        const foo = Foo.new() as any;

        foo.install('one');
        nodeAssert.strictEqual(foo._cb(), 'one');

        foo.install('two');
        nodeAssert.strictEqual(foo._cb(), 'two');
    });

    test('a read-only, non-configurable own callback is visible', () => {
        class Foo extends Contracted {
            _v = 0;
        }

        const foo = Foo.new() as any,
            callback = () => 'called';

        Object.defineProperty(foo, '_cb', {
            value: callback, writable: false, enumerable: true, configurable: false,
        });

        nodeAssert.strictEqual(foo._cb, callback);
    });

    test('the checks-off position agrees with the checks-on one', () => {
        // Both positions return the assigned function, so turning the switch does not
        // change what a consumer's callback identity comparison yields.
        class On extends Contracted {
            _v = 0;
            install(): () => string {
                const callback = () => 'called';

                (this as any)._cb = callback;

                return callback;
            }
        }

        class Off extends Contracted {
            static [checkedMode] = false;

            _v = 0;
            install(): () => string {
                const callback = () => 'called';

                (this as any)._cb = callback;

                return callback;
            }
        }

        for (const Class of [On, Off]) {
            const instance: any = Class.new(),
                installed = instance.install();

            nodeAssert.strictEqual(instance._cb, installed);
        }
    });
});

/**
 * The contracts-off path must keep the body on the raw target.
 *
 * A body is `C` in `{ P } C { Q }` and is unconstrained: it may mutate its own
 * state, including public properties. A member returned *unwrapped* gives that
 * call the proxy as its receiver, so the body's own write re-enters the `set` trap
 * and is refused as though it came from a caller. Turning the checks off removes the
 * checks; it does not change where the body runs.
 */
describe('With the contracts off the body still runs on the instance', () => {
    class PublicWrite extends Contracted {
        static [checkedMode] = false;

        publicProp = 1;

        @ensures(() => false)
        write(): void { this.publicProp = 2; }
    }

    test('a body may assign to its own public property', () => {
        const foo = PublicWrite.new() as any;

        nodeAssert.doesNotThrow(() => foo.write());
        nodeAssert.strictEqual(foo.publicProp, 2);
    });

    test('a body may call its own features', () => {
        class Nested extends Contracted {
            static [checkedMode] = false;

            protected _n = 0;

            @ensures(() => false)
            inner(): number { this._n++; return this._n; }

            @ensures(() => false)
            outer(): number { return this.inner(); }
        }

        const nested = Nested.new() as any;

        nodeAssert.strictEqual(nested.outer(), 1);
    });

    test('the lifecycle is still skipped', () => {
        class Counting extends Contracted {
            static [checkedMode] = false;

            protected _n = 0;

            @ensures(() => false)
            bump(): number { this._n++; return this._n; }
        }

        const counting = Counting.new() as any;

        // The postcondition would fail every time if it ran.
        nodeAssert.strictEqual(counting.bump(), 1);
        nodeAssert.strictEqual(counting.bump(), 2);
    });

    test('a setter body may assign to its own public property', () => {
        class Foo extends Contracted {
            static [checkedMode] = false;

            publicProp = 1;
            protected _value = 0;

            get value() { return this._value; }
            set value(v: number) { (this as any).publicProp = 2; this._value = v; }
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(() => { foo.value = 1; });
        nodeAssert.strictEqual(foo.publicProp, 2);
        nodeAssert.strictEqual(foo.value, 1);
    });

    test('a getter body may assign to its own public property', () => {
        class Foo extends Contracted {
            static [checkedMode] = false;

            publicProp = 1;

            get value(): number { (this as any).publicProp = 2; return 0; }
        }

        const foo = Foo.new() as any;

        nodeAssert.strictEqual(foo.value, 0);
        nodeAssert.strictEqual(foo.publicProp, 2);
    });

    test('a mutating body is not slowed by turning the checks off', () => {
        /*
         * The switch exists so a production build can skip the checking cost. With
         * the member returned unwrapped, every write inside the body reached a trap
         * instead of the target, so turning the checks off made a mutating body
         * slower. Measured as a ratio so the assertion does not depend on the rate
         * of the machine it runs on.
         */
        class On extends Contracted {
            protected _v = 0;
            @ensures(() => true)
            bump(): number { return ++(this as any)._v; }
        }

        class Off extends Contracted {
            static [checkedMode] = false;

            protected _v = 0;
            @ensures(() => true)
            bump(): number { return ++(this as any)._v; }
        }

        const on = On.new() as any,
            off = Off.new() as any;

        const measure = (instance: any): number => {
            for (let i = 0; i < 20_000; i++) instance.bump();

            const started = process.hrtime.bigint();

            for (let i = 0; i < 200_000; i++) instance.bump();

            return Number(process.hrtime.bigint() - started);
        };

        // Warm both before either is timed.
        measure(on);
        measure(off);

        const onTime = measure(on),
            offTime = measure(off);

        nodeAssert.ok(
            offTime < onTime,
            `the checks-off path must not be slower: on=${onTime}ns off=${offTime}ns`,
        );
    });
});

/**
 * A read of a contracted feature is still not a lifecycle when the checks are
 * off, so the thenable rule cannot be the reason to wrap a getter.
 */
describe('With the contracts off a read stays a read', () => {
    test('a getter returning a promise is not refused', () => {
        class Foo extends Contracted {
            static [checkedMode] = false;

            get pending(): Promise<number> { return Promise.resolve(1); }
        }

        nodeAssert.doesNotThrow(() => { void (Foo.new() as any).pending; });
    });

    test('a method returning a promise is not refused', () => {
        class Foo extends Contracted {
            static [checkedMode] = false;

            @demands(() => false)
            pending(): Promise<number> { return Promise.resolve(1); }
        }

        nodeAssert.doesNotThrow(() => { void (Foo.new() as any).pending(); });
    });

    test('a schema arm is not consulted', () => {
        let consulted = false;

        const schema: any = {
            '~standard': {
                version: 1,
                vendor: 'test',
                validate: () => { consulted = true; return { value: undefined }; },
            },
        };

        class Foo extends Contracted {
            static [checkedMode] = false;

            @demands(schema)
            method(): void { }
        }

        nodeAssert.doesNotThrow(() => (Foo.new() as any).method());
        nodeAssert.strictEqual(consulted, false);
    });
});

/**
 * Reading a feature still yields a stable reference, which is what keeps
 * `f.m === f.m` true and a detached method call working.
 */
describe('The checks-off wrapper is stable', () => {
    test('the same feature read twice is the same function', () => {
        class Foo extends Contracted {
            static [checkedMode] = false;

            @ensures(() => false)
            method(): void { }
        }

        const foo = Foo.new() as any;

        nodeAssert.strictEqual(foo.method, foo.method);
    });

    test('the checks-off wrapper is not the raw prototype function', () => {
        class Foo extends Contracted {
            static [checkedMode] = false;

            @ensures(() => false)
            method(): void { }
        }

        const foo = Foo.new() as any;

        // Identity with the raw member would mean the body ran on the proxy.
        nodeAssert.notStrictEqual(foo.method, Foo.prototype.method);
    });
});
