import { AssertionError, checkedMode, Contracted, ensures, type EnsuresSubject } from '@final-hill/decorator-contracts';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

describe('Ensures assertions can be defined for a class feature', () => {
    test('Basic Definition', () => {
        const nonNegative = (self: Foo): boolean => self.value >= 0,
            isEven = (self: Foo): boolean => self.value % 2 == 0

        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(val: number) { this._value = val; }

            @ensures(({ self }) => nonNegative(self) && isEven(self))
            inc(): void { this.value += 2; }

            @ensures(({ self }) => nonNegative(self) && isEven(self))
            dec(): void { this.value -= 1; }
        }

        const foo = Foo.new();

        nodeAssert.doesNotThrow(() => foo.inc());

        nodeAssert.strictEqual(foo.value, 2);

        nodeAssert.throws(() => {
            foo.dec();
        }, AssertionError);
    });
});

describe('Overridden features are still subject to the ensures assertion ', () => {
    class Base extends Contracted {
        private _value = 0;
        get value() { return this._value; }
        set value(val: number) { this._value = val; }

        @ensures(({ self }) => self.value >= 0)
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

    test('dec(); throws', () => {
        nodeAssert.throws(() => {
            const sub = Sub.new();
            sub.dec();
        });
    });
});

describe('The ensures assertion is evaluated after its associated feature is called', () => {
    class Foo extends Contracted {
        private _value = 0;
        get value() { return this._value; }
        set value(val: number) { this._value = val; }
    }

    test('true @ensures check does not throw', () => {
        class Bar extends Foo {
            @ensures(({ self }) => self.value >= 0)
            method(): number { return this.value = 2; }
        }

        const bar = Bar.new();

        nodeAssert.strictEqual(bar.method(), 2);
    });

    test('false @ensures check throws', () => {
        class Bar extends Foo {
            @ensures(() => false)
            method(): number { return this.value = 12; }
        }
        const bar = Bar.new();

        nodeAssert.throws(() => { bar.method(); });
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/283
 */
describe('`ensures` predicates must return a boolean', () => {
    test('an asynchronous predicate is rejected instead of silently passing', () => {
        class Foo extends Contracted {
            @ensures(() => Promise.resolve(true) as any)
            method(): void { }
        }

        nodeAssert.throws(
            () => Foo.new().method(),
            /@ensures predicate #1 for Foo\.method returned a Promise/
        );
    });

    test('a truthy non-boolean is rejected', () => {
        class Foo extends Contracted {
            @ensures(() => 'yes' as any)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method(), /returned the string "yes"/);
    });

    test('boolean predicates continue to work', () => {
        class Foo extends Contracted {
            @ensures(() => true)
            method(): void { }
        }

        nodeAssert.doesNotThrow(() => Foo.new().method());
    });
});

describe('`ensures` assertions are enabled in checkedMode and disabled otherwise', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        class Foo extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method());
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        Contracted[checkedMode] = false;

        class Foo extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        nodeAssert.doesNotThrow(() => Foo.new().method());

        Contracted[checkedMode] = true;
    });
});

describe('Postconditions cannot be weakened in a subtype', () => {
    class Base extends Contracted {
        @ensures(({ args: [value] }) => 10 <= value && value <= 30)
        method(value: number): number { return value; }
    }

    test('Base postcondition', () => {
        const base = Base.new();

        nodeAssert.strictEqual(base.method(15), 15);
        nodeAssert.strictEqual(base.method(25), 25);
        nodeAssert.throws(() => base.method(5), AssertionError);
        nodeAssert.throws(() => base.method(35), AssertionError);
    });

    class Weaker extends Base {
        @ensures(({ args: [value] }) => 1 <= value && value <= 50)
        override method(value: number): number { return value; }
    }

    test('Weaker postcondition', () => {
        const weaker = Weaker.new();

        nodeAssert.strictEqual(weaker.method(15), 15);
        nodeAssert.strictEqual(weaker.method(25), 25);
        nodeAssert.throws(() => weaker.method(5), AssertionError);
        nodeAssert.throws(() => weaker.method(35), AssertionError);
    });

    class Stronger extends Base {
        @ensures(({ args: [value] }) => 15 <= value && value <= 20)
        override method(value: number): number { return value; }
    }

    test('Stronger postcondition', () => {
        const stronger = Stronger.new();

        nodeAssert.strictEqual(stronger.method(15), 15);
        nodeAssert.strictEqual(stronger.method(20), 20);
        nodeAssert.throws(() => stronger.method(25), AssertionError);
        nodeAssert.throws(() => stronger.method(5), AssertionError);
        nodeAssert.throws(() => stronger.method(35), AssertionError);
    });
});

describe('ensures has access to the properties of the instance class before its associated member was executed', () => {
    test('Stack Size', () => {
        class Stack<T> extends Contracted {
            private _implementation: T[] = [];
            private _size = 0;

            get size() { return this._size; }

            @ensures(({ self, old }) => self.size == old.size - 1)
            pop(): T {
                const result = this._implementation.pop()!;
                this._size = this._implementation.length;

                return result;
            }

            @ensures(({ self, old }) => self.size == old.size + 1)
            push(item: T): void {
                this._implementation.push(item);
                this._size = this._implementation.length;
            }
        }

        const stack = Stack.new() as Stack<string>;

        nodeAssert.strictEqual(stack.size, 0);
        nodeAssert.doesNotThrow(() => {
            stack.push('a');
            stack.push('b');
            stack.push('c');
        });
        nodeAssert.doesNotThrow(() => stack.pop());
        nodeAssert.strictEqual(stack.size, 2);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/332
 *
 * `@ensures` is AND-composed, so a throwing arm rejects the invocation on its own.
 * The difference from `@demands` is what survives: every arm is still evaluated, so
 * the caller learns about all broken postconditions rather than only the first, and
 * the thrown value is what reaches them.
 */
describe('A throwing `@ensures` arm rejects without hiding its siblings', () => {
    class Failed extends Error {
        override name = 'Failed';
    }

    test('both a throwing arm and a falsy arm are reported', () => {
        let siblingRan = false;

        class Foo extends Contracted {
            @ensures(() => { siblingRan = true; return false; })
            @ensures(() => { throw new Failed('no'); })
            method(): void { }
        }

        try {
            (Foo.new() as any).method();
            nodeAssert.fail('expected a contract failure');
        } catch (error: any) {
            // Compared as a boolean: `nodeAssert.ok(error instanceof Failed)` narrows
            // `error` to `Failed`, which does not declare `violation`.
            nodeAssert.strictEqual(error instanceof Failed, true, 'the thrown value reaches the caller');
            nodeAssert.strictEqual(siblingRan, true, 'a throwing arm does not short-circuit the others');
            nodeAssert.deepStrictEqual(error.violation.failedIndices, [0, 1]);
            nodeAssert.deepStrictEqual(error.violation.thrownIndices, [0]);
        }
    });

    test('a throwing arm and a passing arm still rejects the invocation', () => {
        class Foo extends Contracted {
            @ensures(() => true)
            @ensures(() => { throw new Failed('no'); })
            method(): number { return 1; }
        }

        // AND-composition: one satisfied arm does not excuse a broken one.
        nodeAssert.throws(() => (Foo.new() as any).method(), (error: any) => error instanceof Failed);
    });

    test('no throwing arm means an AssertionError listing the falsy arm', () => {
        class Foo extends Contracted {
            @ensures(() => true)
            @ensures(() => false)
            method(): void { }
        }

        nodeAssert.throws(
            () => (Foo.new() as any).method(),
            (error: any) => error.name === 'AssertionError'
                && error.violation.thrownIndices === undefined
                && error.violation.failedIndices.length === 1,
        );
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/331
 *
 * A postcondition predicate receives the feature's result as `result`. Every arm
 * of one composition is given the same raw value, which is what makes
 * AND-composition a claim about one thing: "every arm holds" says nothing if each
 * arm was shown a different value.
 */
describe('A postcondition predicate can read the result', () => {
    test('`result` is the value the feature returned', () => {
        class Foo extends Contracted {
            @ensures(({ result }) => result === 42)
            method(): number { return 42; }
        }

        nodeAssert.doesNotThrow(() => (Foo.new() as Foo).method());
    });

    test('a result that violates the postcondition rejects the call', () => {
        class Foo extends Contracted {
            @ensures(({ result }: EnsuresSubject<Foo, [], { state: string }>) => result.state === 'Proposed')
            submit(): { state: string } { return { state: 'Draft' }; }
        }

        nodeAssert.throws(
            () => (Foo.new() as Foo).submit(),
            (error: any) => error.name === 'AssertionError'
                && error.violation.contract === '@ensures',
        );
    });

    test('the result is the value a getter returned', () => {
        class Foo extends Contracted {
            public _value = 7;

            @ensures(({ result }) => result === 7)
            get value() { return this._value; }
        }

        nodeAssert.strictEqual((Foo.new() as Foo).value, 7);
    });

    test('a setter observes the assigned value as its result', () => {
        let observed: unknown;

        class Foo extends Contracted {
            public _value = 0;

            @ensures(({ result }) => { observed = result; return true; })
            set value(v: number) { this._value = v; }
        }

        const foo = Foo.new() as Foo;

        foo.value = 5;
        nodeAssert.strictEqual(observed, 5);
    });

    test('the result is the settled value for an async feature', async () => {
        let observed: unknown;

        class Foo extends Contracted {
            // The predicate stays synchronous: contract evaluation is synchronous,
            // so what it observes is the value the promise settled to, which the
            // lifecycle awaits before calling it.
            @ensures(({ result }) => { observed = result; return true; })
            async method(): Promise<number> { return 99; }
        }

        nodeAssert.strictEqual(await (Foo.new() as Foo).method(), 99);
        nodeAssert.strictEqual(observed, 99, 'the settled value, not the promise');
        nodeAssert.strictEqual((observed as any) instanceof Promise, false, 'a promise here would mean the boundary moved');
    });

    test('a rejecting async feature never reaches the postcondition', async () => {
        let ran = false;

        class Foo extends Contracted {
            @ensures(() => { ran = true; return true; })
            async method(): Promise<number> { throw new Error('body failed'); }
        }

        await nodeAssert.rejects(() => (Foo.new() as Foo).method() as Promise<number>, /body failed/);
        nodeAssert.strictEqual(ran, false, 'there is no value to describe when the body rejected');
    });

    test('the result is the yielded value of each generator step', () => {
        const observed: unknown[] = [];

        class Foo extends Contracted {
            @ensures(({ result }) => { observed.push(result); return true; })
            *gen(): Generator<number> {
                // Two different values: a predicate handed the *previous* step's
                // value, or the iterator itself, is distinguishable only if the
                // steps differ.
                yield 1;
                yield 2;
            }
        }

        nodeAssert.deepStrictEqual([...(Foo.new() as Foo).gen()], [1, 2]);
        nodeAssert.deepStrictEqual(observed, [1, 2]);
    });
});

describe('The result is the raw value, shared by every arm', () => {
    /*
     * AND-composition is only meaningful if every arm is shown the same subject.
     * A normalizing schema validates the raw value and *then* replaces what the
     * caller receives, so a predicate must be handed that raw value too.
     */
    const padded = {
        '~standard': {
            version: 1 as const,
            vendor: 'test',
            validate: (value: unknown) => ({ value: String(value).trim() }),
        },
    };

    test('a predicate sees the raw result, not the normalized one', () => {
        const seen: unknown[] = [];

        class Foo extends Contracted {
            // Source order is the reverse of evaluation order: decorators register
            // bottom-up, so the schema arm below the predicate is evaluated *first*
            // and has already replaced the running value by the time the predicate
            // runs. That is the only arrangement in which "raw" and "normalized"
            // differ when the predicate is called.
            @ensures(({ result }) => { seen.push(result); return true; })
            @ensures(padded as any, { normalize: true })
            method(): string { return '  padded  '; }
        }

        // The caller receives the normalized value...
        nodeAssert.strictEqual((Foo.new() as Foo).method(), 'padded');

        // ...but the predicate was shown what the schema validated.
        nodeAssert.deepStrictEqual(seen, ['  padded  ']);
    });

    test('a predicate and a schema arm agree about the subject', () => {
        const subjects: [string, unknown][] = [];

        const recording = {
            '~standard': {
                version: 1 as const,
                vendor: 'test',
                validate: (value: unknown) => { subjects.push(['schema', value]); return { value }; },
            },
        };

        class Foo extends Contracted {
            @ensures(recording as any)
            @ensures(({ result }) => { subjects.push(['predicate', result]); return true; })
            method(): string { return 'raw'; }
        }

        (Foo.new() as Foo).method();

        // Both arms were shown the same string, whichever order they ran in.
        nodeAssert.deepStrictEqual(subjects.map(entry => entry[1]), ['raw', 'raw']);
    });
});
