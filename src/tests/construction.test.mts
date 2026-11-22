import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, invariant, rescue } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/296
 *
 * `_allowConstruction` was a boolean, so the gate stayed open for the whole
 * duration of a constructor. A class that constructed itself obtained a **raw,
 * unproxied instance**, through which encapsulation was bypassed entirely.
 *
 * The nested construction also recursed forever, so a naive `try/catch` sees a
 * `RangeError` and mistakes it for a rejection. These tests therefore use a
 * depth guard and inspect what the nested construction actually produced.
 */
describe('The construction guard cannot be borrowed by a nested construction', () => {
    /**
     * Constructs `A` from inside `A`'s own constructor, one level deep, and
     * returns whatever that nested construction produced.
     */
    const nestedConstruction = (): { produced: unknown } => {
        const result: { produced: unknown } = { produced: 'not attempted' };

        class Foo extends Contracted {
            static depth = 0;
            protected _value = 1;
            get value() { return this._value; }

            constructor() {
                super();

                if (Foo.depth++ === 0) {
                    try { result.produced = new (Foo as any)(); }
                    catch (error) { result.produced = error; }
                }
            }
        }

        Foo.new();

        return result;
    };

    test('constructing the same class inside its own constructor is rejected', () => {
        const { produced } = nestedConstruction();

        nodeAssert.ok(produced instanceof TypeError, `expected a TypeError, got ${String(produced)}`);
        nodeAssert.match((produced as Error).message, /Use the static 'new' method/);
    });

    test('no raw, unproxied instance escapes', () => {
        const { produced } = nestedConstruction();

        nodeAssert.ok(produced instanceof TypeError, `expected a rejection, got ${String(produced)}`);

        // A `TypeError` is itself an object, so check for the markers a real
        // instance would have rather than comparing `typeof`.
        nodeAssert.strictEqual((produced as any).value, undefined, 'nothing instance-shaped may escape');
    });

    test('encapsulation cannot be bypassed through a nested construction', () => {
        let bypassed: boolean | undefined;

        class Foo extends Contracted {
            static depth = 0;
            publicProp = 1;

            constructor() {
                super();

                if (Foo.depth++ === 0) {
                    try {
                        const nested: any = new (Foo as any)();
                        nested.publicProp = 99;
                        bypassed = nested.publicProp === 99;
                    } catch { /* rejected, so nothing to bypass */ }
                }
            }
        }

        Foo.new();

        nodeAssert.notStrictEqual(bypassed, true, 'the nested instance must not be usable');
    });

    test('constructing a subclass inside a superclass constructor is rejected', () => {
        let outcome: unknown = 'not attempted';

        class Base extends Contracted { }

        class Sub extends Base {
            static depth = 0;

            constructor() {
                super();

                if (Sub.depth++ === 0) {
                    try { outcome = new (Sub as any)(); }
                    catch (error) { outcome = error; }
                }
            }
        }

        Sub.new();

        nodeAssert.ok(outcome instanceof TypeError, `expected a TypeError, got ${String(outcome)}`);
    });

    test('direct construction is still rejected', () => {
        class Foo extends Contracted { }

        nodeAssert.throws(() => new (Foo as any)(), /Use the static 'new' method/);
    });
});

describe('Ordinary construction is unaffected', () => {
    test('repeated construction works and leaves no residue', () => {
        class Foo extends Contracted {
            constructor(public readonly value: number) { super(); }
        }

        nodeAssert.strictEqual(Foo.new(1).value, 1);
        nodeAssert.strictEqual(Foo.new(2).value, 2);
        nodeAssert.strictEqual((Foo as any)._allowedConstructions, 0);
    });

    test('a constructor that throws leaves the guard closed', () => {
        class Foo extends Contracted {
            constructor() {
                super();
                throw new Error('during construction');
            }
        }

        nodeAssert.throws(() => Foo.new(), /during construction/);
        nodeAssert.strictEqual((Foo as any)._allowedConstructions, 0);

        // The guard is per class, so an unrelated class must be unaffected.
        class Bar extends Contracted { }

        nodeAssert.doesNotThrow(() => Bar.new());
        nodeAssert.throws(() => new (Bar as any)(), /Use the static 'new' method/);
    });

    test('a class may construct a *different* contracted class inside its constructor', () => {
        let built: unknown;

        class Other extends Contracted { }

        class Host extends Contracted {
            constructor() {
                super();
                built = Other.new();
            }
        }

        nodeAssert.doesNotThrow(() => Host.new());
        nodeAssert.ok(built, 'the separate class has its own grant');
    });

    test('field initialisers and constructor writes are unrestricted', () => {
        class Foo extends Contracted {
            publicProp = 2;

            constructor() {
                super();
                this.publicProp = 3;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).publicProp, 3);
    });

    test('an invalid initial state is caught by the invariant', () => {
        @invariant(({ self }) => self.publicProp < 3)
        class Foo extends Contracted {
            publicProp = 2;

            constructor() {
                super();
                this.publicProp = 9;
            }
        }

        nodeAssert.throws(() => Foo.new(), /@invariant failed/);
    });
});

describe('A `@rescue` handler cannot supply the result', () => {
    test('a value returned from the handler is ignored', () => {
        class Foo extends Contracted {
            @rescue(() => 42 as any)
            method(): number { throw new Error('boom'); }
        }

        nodeAssert.throws(() => (Foo.new() as any).method(), /boom/);
    });

    test('only `retry` produces a result', () => {
        class Foo extends Contracted {
            protected _attempts = 0;

            @rescue(({ retry }) => retry())
            method(): number {
                if (this._attempts++ === 0) throw new Error('first');

                return 42;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).method(), 42);
    });
});
