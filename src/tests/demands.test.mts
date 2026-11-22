import { AssertionError, checkedMode, Contracted, demands, type DemandsSubject } from '@final-hill/decorator-contracts';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

describe('Demands assertions can be defined for a class feature', () => {
    test('Basic definition', () => {
        const nonNegative = (self: Foo): boolean => self.value >= 0,
            isEven = (self: Foo): boolean => self.value % 2 == 0

        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }

            @demands(({ self }) => nonNegative(self) && isEven(self))
            inc(): void { this.value += 2; }

            @demands(({ self }) => nonNegative(self) && isEven(self))
            dec(): void { this.value -= 1; }
        }

        const foo = Foo.new();

        nodeAssert.doesNotThrow(() => foo.inc());

        nodeAssert.strictEqual(foo.value, 2);

        nodeAssert.throws(() => {
            foo.dec();
            foo.dec();
        }, AssertionError);
    });
});

describe('Overridden features are still subject to the demands assertion', () => {
    class Base extends Contracted {
        protected _value = 0;
        get value() { return this._value; }
        set value(v: number) { this._value = v; }

        @demands(({ self }) => self.value >= 0)
        dec(): void { this.value--; }
        inc(): void { this.value++; }
    }

    class Sub extends Base {
        override dec(): void { this.value -= 2; }
    }

    test('inc(); inc(); dec(); does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const sub = Sub.new();
            sub.inc();
            sub.inc();
            sub.dec();
        });
    });

    test('dec(); dec(); throws', () => {
        nodeAssert.throws(() => {
            const sub = Sub.new();
            sub.dec();
            sub.dec();
        }, AssertionError);
    });

    class SubSub extends Sub {
        override dec(): void { this.value -= 4; }
    }

    test('inc(); inc(); inc(); inc(): dec(); does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const subSub = SubSub.new();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.dec();
        });
    });

    test('inc(); inc(); inc(); inc(): dec(); dec(); dec(); throws', () => {
        nodeAssert.throws(() => {
            const subSub = SubSub.new();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.dec();
            subSub.dec();
            subSub.dec();
        }, AssertionError);
    });
});

describe('The `demands` assertion is evaluated before its associated feature is called', () => {
    class Foo extends Contracted {
        protected _value = 0;
        get value() { return this._value; }
        set value(v: number) { this._value = v; }
    }

    test('true "demands" check does not throw', () => {
        class Bar extends Foo {
            @demands(({ self }) => self.value >= 0)
            method(): number {
                return this.value = -2;
            }
        }

        const bar = Bar.new();

        nodeAssert.strictEqual(bar.method(), -2);
    });

    test('false "demands" check throws', () => {
        class Bar extends Foo {
            @demands(() => false)
            method(): number {
                return this.value = 12;
            }
        }

        const bar = Bar.new();

        nodeAssert.throws(() => bar.method());
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/283
 */
describe('`demands` predicates must return a boolean', () => {
    test('an asynchronous predicate is rejected instead of silently passing', () => {
        class Foo extends Contracted {
            @demands(() => Promise.resolve(true) as any)
            method(): void { }
        }

        // a Promise is truthy, so coercion would have treated this as satisfied
        nodeAssert.throws(
            () => Foo.new().method(),
            /@demands predicate #1 for Foo\.method returned a Promise/
        );
    });

    test('an asynchronous predicate returning false is rejected, not accepted', () => {
        class Foo extends Contracted {
            @demands(() => Promise.resolve(false) as any)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method(), AssertionError);
    });

    test('a truthy string is rejected', () => {
        class Foo extends Contracted {
            @demands(() => 'false' as any)
            method(): void { }
        }

        nodeAssert.throws(
            () => Foo.new().method(),
            /returned the string "false"/
        );
    });

    test('a truthy object is rejected', () => {
        class Foo extends Contracted {
            @demands(() => ({ satisfied: true }) as any)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method(), /returned an object/);
    });

    test('`undefined` is rejected with a specific message', () => {
        class Foo extends Contracted {
            @demands(() => undefined as any)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method(), /returned undefined/);
    });

    test('the message identifies which predicate in a composition failed', () => {
        class Foo extends Contracted {
            @demands(({ args: [value] }: DemandsSubject<Foo, [number]>) => value > 0)
            @demands(() => 'invalid' as any)
            method(value: number): number { return value; }
        }

        // the last decorator applied is evaluated first
        nodeAssert.throws(
            () => Foo.new().method(-1),
            /@demands predicate #1 for Foo\.method returned the string "invalid"/
        );
    });

    test('boolean predicates continue to work', () => {
        class Foo extends Contracted {
            @demands(({ args: [value] }: DemandsSubject<Foo, [number]>) => value > 0)
            method(value: number): number { return value; }
        }

        nodeAssert.strictEqual(Foo.new().method(3), 3);
        nodeAssert.throws(() => Foo.new().method(0), /@demands failed/);
    });
});

describe('`demands` assertions are enabled in `checkedMode` and disabled otherwise', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        class Foo extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method());
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        class Foo extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        Contracted[checkedMode] = false;
        nodeAssert.doesNotThrow(() => Foo.new().method());
        Contracted[checkedMode] = true;
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/284
 */
describe('Predicates are registered once, not once per instantiation', () => {
    const predicatesOf = (Class: any, key: 'demands' | 'ensures', name: string): unknown[] =>
        Class[Symbol.metadata][key][name] ?? [];

    test('the predicate list does not grow with instantiation count', () => {
        class Foo extends Contracted {
            @demands(() => true)
            method(): void { }
        }

        Foo.new();
        const initial = predicatesOf(Foo, 'demands', 'method').length;

        for (let i = 0; i < 100; i++) Foo.new();

        nodeAssert.strictEqual(predicatesOf(Foo, 'demands', 'method').length, initial);
    });

    test('a predicate is evaluated once per call regardless of instance count', () => {
        let evaluations = 0;

        class Foo extends Contracted {
            @demands(() => { evaluations++; return true; })
            method(): void { }
        }

        for (let i = 0; i < 50; i++) Foo.new();

        evaluations = 0;
        Foo.new().method();

        nodeAssert.strictEqual(evaluations, 1);
    });

    test('stacked declarations are all retained', () => {
        class Foo extends Contracted {
            @demands(() => false)
            @demands(() => true)
            method(): void { }
        }

        nodeAssert.strictEqual(predicatesOf(Foo, 'demands', 'method').length, 2);
        // demands are OR-composed, so the true one satisfies the obligation
        nodeAssert.doesNotThrow(() => Foo.new().method());
    });

    test('a subclass still composes its predicates with the base class', () => {
        const evaluated: string[] = [];

        class Base extends Contracted {
            @demands(({ args: [v] }: DemandsSubject<Base, [number]>) => { evaluated.push('base:' + v); return false; })
            foo(v: number): number { return v; }
        }

        class Sub extends Base {
            @demands(({ args: [v] }: DemandsSubject<Sub, [number]>) => { evaluated.push('sub:' + v); return false; })
            override foo(v: number): number { return v; }
        }

        nodeAssert.throws(() => Sub.new().foo(1));
        nodeAssert.deepStrictEqual(evaluated, ['base:1', 'sub:1']);
    });

    test('decorating a class that does not extend Contracted is rejected', () => {
        nodeAssert.throws(() => {
            class NotContracted {
                @demands(() => true)
                method(): void { }
            }

            return new NotContracted();
        }, /can only be applied to classes that extend Contracted/);
    });
});


describe('`demands` assertions cannot be strengthened in a subtype', () => {
    class Base extends Contracted {
        @demands(({ args: [value] }: DemandsSubject<Contracted, [number]>) => 10 <= value && value <= 30)
        method(value: number): number { return value; }
    }

    test('Base demands', () => {
        const base = Base.new();

        nodeAssert.strictEqual(base.method(15), 15);
        nodeAssert.throws(() => base.method(5), AssertionError);
        nodeAssert.throws(() => base.method(35), AssertionError);
    });

    class Weaker extends Base {
        @demands(({ args: [value] }: DemandsSubject<Contracted, [number]>) => 1 <= value && value <= 50)
        override method(value: number): number { return value; }
    }

    test('Weaker precondition', () => {
        const weaker = Weaker.new();

        nodeAssert.strictEqual(weaker.method(15), 15);
        nodeAssert.strictEqual(weaker.method(5), 5);
        nodeAssert.strictEqual(weaker.method(35), 35);
        nodeAssert.throws(() => weaker.method(0), AssertionError);
        nodeAssert.throws(() => weaker.method(60), AssertionError);
    });

    class Stronger extends Base {
        @demands(({ args: [value] }: DemandsSubject<Contracted, [number]>) => 15 <= value && value <= 20)
        override method(value: number): number { return value; }
    }

    test('Stronger precondition', () => {
        const stronger = Stronger.new();

        nodeAssert.strictEqual(stronger.method(15), 15);
        nodeAssert.throws(() => stronger.method(5), AssertionError);
        nodeAssert.throws(() => stronger.method(35), AssertionError);
        nodeAssert.strictEqual(stronger.method(25), 25);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/332
 *
 * A predicate that throws has answered "no". It has not withdrawn the other arms,
 * because `@demands` is OR-composed: a subtype may weaken a precondition, and an
 * arm that throws must not be able to deny a call that a sibling arm permits.
 */
describe('A throwing predicate is a failed arm, not an abort', () => {
    class Denied extends Error {
        override name = 'Denied';
    }

    class Base extends Contracted {
        @demands(({ args: [x] }: DemandsSubject<Base, [number]>) => { if (x !== 42) throw new Denied('not 42'); return true; })
        method(x: number): number { return x; }
    }

    class Sub extends Base {
        @demands(({ args: [x] }: DemandsSubject<Sub, [number]>) => x === 7)
        override method(x: number): number { return x; }
    }

    test('a later arm still permits the call after an earlier arm throws', () => {
        const sub = Sub.new();

        // Arm 2 (`x === 7`) is the reason this is permitted; arm 1 threw.
        nodeAssert.strictEqual(sub.method(7), 7);
    });

    test('an arm that passes still permits the call when a sibling would throw', () => {
        // `42` satisfies arm 1, so arm 2's `x === 7` is irrelevant and no throw
        // occurs. This pins that passing is evaluated on its own terms.
        nodeAssert.strictEqual(Sub.new().method(42), 42);
    });

    test('a call every arm rejects re-raises the thrown value', () => {
        nodeAssert.throws(
            () => Sub.new().method(1),
            (error: any) => error instanceof Denied,
            'the typed error reaches the caller rather than an AssertionError',
        );
    });

    test('a false arm and a throwing arm: the thrown value wins', () => {
        class Mixed extends Contracted {
            @demands(({ args: [_x] }: DemandsSubject<Mixed, [number]>) => { throw new Denied('explicit'); })
            @demands(({ args: [_x] }: DemandsSubject<Mixed, [number]>) => false)
            method(_x: number): void { }
        }

        nodeAssert.throws(
            () => (Mixed.new() as any).method(1),
            (error: any) => error instanceof Denied && error.message === 'explicit',
        );
    });

    test('every arm is evaluated, so a throw does not short-circuit the report', () => {
        const evaluated: string[] = [];

        class Ordered extends Contracted {
            @demands(({ args: [_x] }: DemandsSubject<Ordered, [number]>) => { evaluated.push('first'); return false; })
            @demands(({ args: [_x] }: DemandsSubject<Ordered, [number]>) => { evaluated.push('second'); return false; })
            method(_x: number): void { }
        }

        nodeAssert.throws(() => (Ordered.new() as any).method(1));
        // Decorators evaluate bottom-up, so the source order is reversed.
        nodeAssert.deepStrictEqual(evaluated, ['second', 'first']);
    });

    test('a predicate bug keeps its own error class', () => {
        class Faulty extends Contracted {
            @demands(({ args: [x] }: DemandsSubject<Faulty, [number]>) => (x as any).missing.deeper)
            method(_x: number): void { }
        }

        try {
            (Faulty.new() as any).method(1);
            nodeAssert.fail('expected the predicate to throw');
        } catch (error: any) {
            // The caller's `catch` branches on the class, so the bug is handled as a
            // bug even though a `violation` is attached for logging.
            nodeAssert.strictEqual(error.constructor.name, 'TypeError');
            nodeAssert.match(error.message, /Cannot read properties/);
            nodeAssert.strictEqual(error.violation.thrown[0].startsWith('TypeError'), true);
        }
    });
});

describe('A re-raised predicate error carries the contract violation', () => {
    class Denied extends Error {
        override name = 'Denied';
    }

    class Foo extends Contracted {
        @demands(({ args: [_x] }: DemandsSubject<Foo, [number]>) => { throw new Denied('denied'); })
        method(_x: number): void { }
    }

    const raised = (): any => {
        try {
            (Foo.new() as any).method(1);
        } catch (error) {
            return error;
        }

        nodeAssert.fail('expected the arm to throw');
    };

    test('the violation names the contract, the feature, and the thrown arm', () => {
        const error = raised();

        nodeAssert.strictEqual(error.name, 'Denied');
        nodeAssert.strictEqual(error.violation.contract, '@demands');
        nodeAssert.strictEqual(error.violation.className, 'Foo');
        nodeAssert.strictEqual(error.violation.feature, 'method');
        nodeAssert.deepStrictEqual(error.violation.failedIndices, [0]);
        nodeAssert.deepStrictEqual(error.violation.thrownIndices, [0]);
        // The record describes the value; the value itself is the error the caller
        // caught, which is where they read it.
        nodeAssert.deepStrictEqual(error.violation.thrown, ['Denied: denied']);
    });

    test('the violation is attached without changing what the error enumerates', () => {
        const error = raised();

        // A domain error that serialises its own properties for logging must not
        // gain a contract record it did not ask for.
        nodeAssert.deepStrictEqual(Object.keys(error), ['name']);
        nodeAssert.doesNotThrow(() => JSON.stringify(error));
    });
});

describe('A thrown non-object is re-raised unchanged', () => {
    test('a thrown string reaches the caller as that string', () => {
        class Foo extends Contracted {
            @demands(({ args: [_x] }: DemandsSubject<Foo, [number]>) => { throw 'plain'; })
            method(_x: number): void { }
        }

        nodeAssert.throws(
            () => (Foo.new() as any).method(1),
            (error: unknown) => error === 'plain',
            'a primitive has nowhere to carry a violation, so it is raised as-is',
        );
    });
});

describe('The first arm that threw decides which value is re-raised', () => {
    class First extends Error {
        override name = 'First';
    }

    class Second extends Error {
        override name = 'Second';
    }

    test('two throwing arms: the one evaluated first wins', () => {
        class Foo extends Contracted {
            @demands(({ args: [_x] }: DemandsSubject<Foo, [number]>) => { throw new First('first'); })
            @demands(({ args: [_x] }: DemandsSubject<Foo, [number]>) => { throw new Second('second'); })
            method(_x: number): void { }
        }

        // Decorators evaluate bottom-up, so the `Second` arm runs first and its
        // value is the one the caller receives.
        nodeAssert.throws(
            () => (Foo.new() as any).method(1),
            (error: any) => error instanceof Second,
        );
    });

    test('the reported thrown indices are in evaluation order', () => {
        class Foo extends Contracted {
            @demands(({ args: [_x] }: DemandsSubject<Foo, [number]>) => { throw new First('first'); })
            @demands(({ args: [_x] }: DemandsSubject<Foo, [number]>) => { throw new Second('second'); })
            method(_x: number): void { }
        }

        try {
            (Foo.new() as any).method(1);
            nodeAssert.fail('expected the arms to reject');
        } catch (caught) {
            const error = caught as any;

            nodeAssert.deepStrictEqual(error.violation.thrownIndices, [0, 1]);
            nodeAssert.deepStrictEqual(error.violation.thrown, ['Second: second', 'First: first']);
        }
    });
});

describe('Only the arms that threw are marked as having thrown', () => {
    test('the message distinguishes a thrown arm from a false one', () => {
        class Foo extends Contracted {
            @demands(({ args: [_x] }: DemandsSubject<Foo, [number]>) => false)
            @demands(({ args: [_x] }: DemandsSubject<Foo, [number]>) => { throw new Error('explicit'); })
            method(_x: number): void { }
        }

        try {
            (Foo.new() as any).method(1);
            nodeAssert.fail('expected the arms to reject');
        } catch (caught) {
            const error = caught as any,
                message: string = error.cause?.message ?? '';

            // The thrown value is what the caller receives, so the contract's own
            // message travels as its `cause`. The thrown arm is marked there; the
            // arm that merely returned `false` is not.
            nodeAssert.match(message, /predicate #1 threw:/);
            nodeAssert.match(message, /predicate #2:/);
            nodeAssert.doesNotMatch(message, /predicate #2 threw:/);
        }
    });
});

describe('A non-boolean verdict stays fatal behind a sibling arm', () => {
    test('an asynchronous predicate is not excused by an arm that passes', () => {
        class Foo extends Contracted {
            // The bottom decorator runs first, so the non-boolean verdict is the
            // one this call reaches first. A sibling arm then satisfies the call —
            // which must not launder a predicate that never answered.
            @demands(() => true)
            @demands(() => Promise.resolve(true) as any)
            method(): void { }
        }

        nodeAssert.throws(
            () => (Foo.new() as any).method(),
            /returned a Promise/,
            'a Promise is truthy, so accepting it is accepting an unchecked contract',
        );
    });

    test('a non-boolean value is not excused by an arm that passes', () => {
        class Foo extends Contracted {
            @demands(() => true)
            @demands(() => 5 as any)
            method(): void { }
        }

        nodeAssert.throws(() => (Foo.new() as any).method(), /returned a number/);
    });
});

describe('An error the contract did not create is annotated defensively', () => {
    test('a frozen error is raised unchanged rather than failing to annotate', () => {
        class Frozen extends Error {
            override name = 'Frozen';
        }

        const boom = Object.freeze(new Frozen('frozen'));

        class Foo extends Contracted {
            @demands(() => { throw boom; })
            method(): void { }
        }

        nodeAssert.throws(
            () => (Foo.new() as any).method(),
            (error: any) => error === boom,
            'the caller must receive the error they were waiting for, not a TypeError about property definition',
        );
        nodeAssert.strictEqual(('violation' in boom), false);
    });

    test('a reused error instance reports the contract that raised it now', () => {
        class Denied extends Error {
            override name = 'Denied';
        }

        const shared = new Denied('shared');

        class Alpha extends Contracted {
            @demands(() => { throw shared; })
            alpha(): void { }
        }

        class Beta extends Contracted {
            @demands(() => { throw shared; })
            beta(): void { }
        }

        try {
            (Alpha.new() as any).alpha();
        } catch {
            /* the first feature claims the record */
        }

        try {
            (Beta.new() as any).beta();
            nodeAssert.fail('expected the arm to throw');
        } catch (error: any) {
            nodeAssert.strictEqual(error.violation.feature, 'beta');
        }
    });

    test('an error with its own `cause` keeps it', () => {
        const underlying = new Error('connection reset'),
            boom = new Error('query failed', { cause: underlying });

        class Foo extends Contracted {
            @demands(() => { throw boom; })
            method(): void { }
        }

        nodeAssert.throws(
            () => (Foo.new() as any).method(),
            (error: any) => error.cause === underlying,
            'the contract must not overwrite the information `cause` exists to carry',
        );
    });
});

describe('A thrown value is recorded as a description, not a reference', () => {
    test('an object without a message is named by its constructor', () => {
        class Denied {
            readonly name = 'Denied';
        }

        class Foo extends Contracted {
            @demands(() => { throw new Denied(); })
            method(): void { }
        }

        try {
            (Foo.new() as any).method();
            nodeAssert.fail('expected the arm to throw');
        } catch (error: any) {
            // `String(value)` would be `[object Object]`, which names nothing.
            nodeAssert.deepStrictEqual(error.violation.thrown, ['Denied']);
        }
    });

    test('a thrown error is not retained by the record', () => {
        class Boom extends Error {
            override name = 'Boom';
        }

        const boom = new Boom('circular'),
            self: any = boom;

        self.self = boom; // an enumerable self-reference

        class Foo extends Contracted {
            @demands(() => { throw boom; })
            method(): void { }
        }

        try {
            (Foo.new() as any).method();
            nodeAssert.fail('expected the arm to throw');
        } catch (error: any) {
            nodeAssert.deepStrictEqual(error.violation.thrown, ['Boom: circular']);
            nodeAssert.doesNotThrow(
                () => JSON.stringify(error.violation),
                'a violation is logged and serialised, so it must stay plain data',
            );
        }
    });
});
