import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { checkedMode, Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/288
 *
 * `docs/happy-path.png` specifies the order
 * `@invariant` -> `@demands` -> body -> `@ensures` -> `@invariant`,
 * so the invariant is evaluated once before and once after a feature.
 */
describe('The assertion lifecycle evaluates the invariant exactly twice per call', () => {
    const counter = () => {
        const state = { evaluations: 0 };
        return state;
    };

    test('a method call', () => {
        const state = counter();

        @invariant(() => { state.evaluations++; return true; })
        class Foo extends Contracted {
            @demands(() => true)
            method(): void { }
        }

        const foo = Foo.new() as any;
        state.evaluations = 0;
        foo.method();

        nodeAssert.strictEqual(state.evaluations, 2);
    });

    test('a getter read', () => {
        const state = counter();

        @invariant(() => { state.evaluations++; return true; })
        class Foo extends Contracted {
            protected _value = 1;
            get value() { return this._value; }
        }

        const foo = Foo.new() as any;
        state.evaluations = 0;
        void foo.value;

        nodeAssert.strictEqual(state.evaluations, 2);
    });

    test('a setter write', () => {
        const state = counter();

        @invariant(() => { state.evaluations++; return true; })
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }
        }

        const foo = Foo.new() as any;
        state.evaluations = 0;
        foo.value = 1;

        nodeAssert.strictEqual(state.evaluations, 2);
    });

    test('a getter that reads another getter does not nest a second lifecycle', () => {
        const state = counter();

        @invariant(() => { state.evaluations++; return true; })
        class Foo extends Contracted {
            protected _value = 1;
            get inner() { return this._value; }
            get outer() { return this.inner; }
        }

        const foo = Foo.new() as any;
        state.evaluations = 0;
        void foo.outer;

        nodeAssert.strictEqual(state.evaluations, 2);
    });

    test('a setter that calls a method does not nest a second lifecycle', () => {
        const state = counter();

        @invariant(() => { state.evaluations++; return true; })
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }

            set value(v: number) { this.assign(v); }

            @demands(() => true)
            assign(v: number): void { this._value = v; }
        }

        const foo = Foo.new() as any;
        state.evaluations = 0;
        foo.value = 1;

        nodeAssert.strictEqual(state.evaluations, 2);
    });

    test('a getter that calls a method does not nest a second lifecycle', () => {
        const state = counter();

        @invariant(() => { state.evaluations++; return true; })
        class Foo extends Contracted {
            protected _value = 1;

            @demands(() => true)
            compute(): number { return this._value; }

            get value() { return this.compute(); }
        }

        const foo = Foo.new() as any;
        state.evaluations = 0;
        void foo.value;

        nodeAssert.strictEqual(state.evaluations, 2);
    });
});

describe('The assertions run in the documented order', () => {
    test('invariant, demands, body, ensures, invariant', () => {
        const sequence: string[] = [];

        @invariant(() => { sequence.push('invariant'); return true; })
        class Foo extends Contracted {
            @demands(() => { sequence.push('demands'); return true; })
            @ensures(() => { sequence.push('ensures'); return true; })
            method(): void { sequence.push('body'); }
        }

        const foo = Foo.new() as any;
        sequence.length = 0;
        foo.method();

        nodeAssert.deepStrictEqual(sequence, ['invariant', 'demands', 'body', 'ensures', 'invariant']);
    });

    test('an invalid state is reported before a failing precondition', () => {
        @invariant((self: Foo) => self.value > 0)
        class Foo extends Contracted {
            protected _value = 1;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }

            @demands(() => false)
            method(): void { }
        }

        const foo = Foo.new() as any;

        // reach an invalid state without tripping the contract
        Contracted[checkedMode] = false;
        try { foo.value = -1; } finally { Contracted[checkedMode] = true; }

        nodeAssert.throws(() => foo.method(), /^Error: Invariant violated/);
    });

    test('the invariant is checked once when a precondition rejects the call', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Foo extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        const foo = Foo.new();
        evaluations = 0;
        nodeAssert.throws(() => foo.method(), /No demands were satisfied/);

        // the entry check runs; the exit check is skipped because the body was
        // never entered
        nodeAssert.strictEqual(evaluations, 1);
    });

    test('an accessor body observes the same `this` binding as a method body', () => {
        const observed: Record<string, boolean> = {};

        class Foo extends Contracted {
            publicProp = 1;

            @demands(() => true)
            method(): void {
                try { (this as any).publicProp = 2; observed.method = false; }
                catch { observed.method = true; }
            }

            get value(): number {
                try { (this as any).publicProp = 3; observed.getter = false; }
                catch { observed.getter = true; }
                return 0;
            }

            set value(_v: number) {
                try { (this as any).publicProp = 4; observed.setter = false; }
                catch { observed.setter = true; }
            }
        }

        const foo = Foo.new() as any;
        foo.method();
        void foo.value;
        foo.value = 1;

        nodeAssert.strictEqual(observed.method, false);
        nodeAssert.strictEqual(observed.getter, observed.method);
        nodeAssert.strictEqual(observed.setter, observed.method);
    });
});
