import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';
import type { StandardSchemaV1 } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/279
 *
 * Minimal `StandardSchemaV1` implementations, written by hand so that the test
 * suite proves schema support works with **no schema library installed**. A real
 * provider (Zod, Valibot, ArkType, Effect Schema) is structurally identical, which
 * is the whole point of the protocol.
 */
const schema = <Input, Output = Input>(
    validate: (value: unknown) => StandardSchemaV1.Result<Output>,
    types?: StandardSchemaV1.Types<Input, Output>,
    vendor = 'hand-rolled',
): StandardSchemaV1<Input, Output> => ({
    '~standard': { version: 1, vendor, types, validate },
});

/**
 * Captures the `AssertionError` a call raises.
 *
 * `nodeAssert.throws` returns `undefined` in Node, so a test that wants to inspect
 * the payload has to catch the error itself.
 */
const capture = (fn: () => unknown): AssertionError => {
    try {
        fn();
    } catch (error) {
        nodeAssert.ok(error instanceof AssertionError, `expected an AssertionError, got ${error}`);

        return error;
    }

    throw new Error('expected the call to throw');
}

const ok = <T,>(value: T): StandardSchemaV1.SuccessResult<T> => ({ value });
const fail = (...messages: string[]): StandardSchemaV1.FailureResult => ({
    issues: messages.map(message => ({ message })),
});
const failAt = (path: PropertyKey[], message: string): StandardSchemaV1.FailureResult => ({
    issues: [{ message, path }],
});

/** Accepts a single positive number, for result positions. */
const positive = schema<number>(value =>
    typeof value === 'number' && value > 0 ? ok(value) : fail('Expected a positive number'));

/**
 * Accepts an argument tuple whose single element is a positive number.
 *
 * `@demands` validates the argument tuple, so a one-argument method is written as
 * a tuple of one. This mirrors how a real provider is used: `z.tuple([z.number()])`.
 */
const positiveArgs = schema<[number]>((value: any) =>
    Array.isArray(value) && value.length === 1 && typeof value[0] === 'number' && value[0] > 0
        ? ok([value[0] as number])
        : fail('Expected a positive number'));

/** Accepts a tuple of two numbers. */
const numberPair = schema<[number, number]>(value =>
    Array.isArray(value) && value.length === 2 && value.every(item => typeof item === 'number')
        ? ok(value as [number, number])
        : fail('Expected a tuple of two numbers'));

/** Accepts a string and trims it, so normalization is observable. */
const trimmed = schema<string, string>(value =>
    typeof value === 'string' ? ok(value.trim()) : fail('Expected a string'));

/** Accepts a one-element argument tuple holding a string, and trims it. */
const trimmedArgs = schema<[string]>((value: any) =>
    Array.isArray(value) && value.length === 1 && typeof value[0] === 'string'
        ? ok([value[0].trim()] as [string])
        : fail('Expected a string'));

describe('A Standard Schema can be used in place of a predicate', () => {
    describe('@demands validates the argument tuple', () => {
        test('a satisfied schema lets the call through', () => {
            class Calculator extends Contracted {
                @demands(numberPair)
                add(...[a, b]: [number, number]): number { return a + b; }
            }

            nodeAssert.equal((Calculator.new() as Calculator).add(2, 3), 5);
        });

        test('a violated schema reports the issues structurally', () => {
            class Calculator extends Contracted {
                @demands(numberPair)
                add(...[a, b]: [number, number]): number { return a + b; }
            }

            const error = capture(() => (Calculator.new() as Calculator).add(2, 'x' as any));

            nodeAssert.equal(error.violation?.contract, '@demands');
            nodeAssert.equal(error.violation?.feature, 'add');
            nodeAssert.deepEqual(error.violation?.issues?.map(issue => issue.message), ['Expected a tuple of two numbers']);
        });

        test('the message names the schema and its vendor', () => {
            class Foo extends Contracted {
                @demands(positiveArgs)
                m(_value: number): void { }
            }

            nodeAssert.throws(() => (Foo.new() as Foo).m(-1), /schema #1: Standard Schema \(vendor: hand-rolled, version: 1\)/);
        });

        test('a nested issue path is rendered in the message', () => {
            const nested = schema(() => failAt(['address', 'zip'], 'Invalid zip'));

            class Foo extends Contracted {
                @demands(nested as any)
                m(_value: unknown): void { }
            }

            nodeAssert.throws(() => (Foo.new() as Foo).m({}), /address\.zip: Invalid zip/);
        });

        test('an issue path is relative to the argument tuple, so the first argument is 0', () => {
            // A provider reports paths against the value it was given. Because
            // the value is the argument tuple, the first argument is index 0.
            const nested = schema(() => failAt([0, 'zip'], 'Invalid zip'));

            class Foo extends Contracted {
                @demands(nested as any)
                m(_value: unknown): void { }
            }

            nodeAssert.throws(() => (Foo.new() as Foo).m({}), /0\.zip: Invalid zip/);
        });
    });

    describe('@ensures validates the result', () => {
        test('a satisfied schema lets the result through', () => {
            class Age extends Contracted {
                @ensures(positive)
                next(value: number): number { return value + 1; }
            }

            nodeAssert.equal((Age.new() as Age).next(10), 11);
        });

        test('a violated schema describes the result, not the arguments', () => {
            class Age extends Contracted {
                @ensures(positive)
                broken(): number { return -1; }
            }

            const error = capture(() => (Age.new() as Age).broken());

            nodeAssert.equal(error.violation?.contract, '@ensures');
            nodeAssert.equal(error.violation?.issues?.[0].message, 'Expected a positive number');
        });

        test('a predicate and a schema can share one postcondition', () => {
            const calls: string[] = [];

            class Age extends Contracted {
                @ensures(positive)
                @ensures((_self: Age, [_value]: [number]) => { calls.push('predicate'); return true; })
                next(value: number): number { return value + 1; }
            }

            nodeAssert.equal((Age.new() as Age).next(1), 2);
            nodeAssert.deepEqual(calls, ['predicate']);
        });
    });

    describe('@invariant validates the instance', () => {
        test('a schema can express the invariant', () => {
            const hasBalance = schema((value: any) =>
                typeof (value as any)?._balance === 'number' && (value as any)._balance >= 0
                    ? ok(value)
                    : fail('balance must be a non-negative number'));

            @invariant(hasBalance)
            class Account extends Contracted {
                public _balance = 0;

                deposit(amount: number): void { this._balance += amount; }
            }

            const account = Account.new() as Account;

            account.deposit(10);
            nodeAssert.equal(account._balance, 10);

            nodeAssert.throws(() => account.deposit(-100), /balance must be a non-negative number/);
        });
    });
});

describe('Composition follows variance', () => {
    test('@demands OR-composes a schema with a predicate', () => {
        class Foo extends Contracted {
            @demands(positiveArgs)
            @demands((_self: Foo, [value]: [number]) => value === 0)
            m(value: number): number { return value; }
        }

        const foo = Foo.new() as Foo;

        nodeAssert.equal(foo.m(5), 5, 'schema arm');
        nodeAssert.equal(foo.m(0), 0, 'predicate arm');
        nodeAssert.throws(() => foo.m(-1), AssertionError, 'neither arm');
    });

    test('@ensures AND-composes a schema with a predicate', () => {
        class Foo extends Contracted {
            @ensures(positive)
            @ensures((_self: Foo, [_value]: [number]) => true)
            m(value: number): number { return value; }
        }

        const foo = Foo.new() as Foo;

        nodeAssert.equal(foo.m(1), 1);
        nodeAssert.throws(() => foo.m(-1), /@ensures failed/, 'the schema arm must still hold');
    });

    test('a subtype may weaken @demands by adding an arm', () => {
        class Base extends Contracted {
            @demands(positiveArgs)
            m(value: number): number { return value; }
        }

        class Sub extends Base {
            // Contravariance: the subtype accepts MORE, so its arm is an
            // alternative rather than an additional restriction.
            @demands((_self: Sub, [value]: [number]) => value === 0)
            override m(value: number): number { return value; }
        }

        const sub = Sub.new() as Sub;

        nodeAssert.equal(sub.m(5), 5, 'inherited schema arm still accepts positive');
        nodeAssert.equal(sub.m(0), 0, 'subtype arm accepts zero');
        nodeAssert.throws(() => sub.m(-1), AssertionError);
    });

    test('a subtype may strengthen @ensures by adding an arm', () => {
        class Base extends Contracted {
            @ensures(positive)
            m(value: number): number { return value; }
        }

        class Sub extends Base {
            @ensures((_self: Sub, [_value]: [number]) => true)
            override m(value: number): number { return value; }
        }

        const sub = Sub.new() as Sub;

        nodeAssert.equal(sub.m(1), 1);
        nodeAssert.throws(() => sub.m(-1), AssertionError, 'the inherited schema arm still holds');
    });
});

describe('Normalization is opt-in', () => {
    test('off by default: the body receives the original value', () => {
        let received: unknown;

        class Foo extends Contracted {
            @demands(trimmedArgs)
            m(value: string): string { received = value; return value; }
        }

        (Foo.new() as Foo).m('  padded  ');
        nodeAssert.equal(received, '  padded  ');
    });

    test('`normalize: true` replaces the arguments the body receives', () => {
        let received: unknown;

        class Foo extends Contracted {
            @demands(trimmedArgs, { normalize: true })
            m(value: string): string { received = value; return value; }
        }

        (Foo.new() as Foo).m('  padded  ');
        nodeAssert.equal(received, 'padded');
    });

    test('a normalized argument is what `@ensures` observes', () => {
        let observed: unknown;

        class Foo extends Contracted {
            @demands(trimmedArgs, { normalize: true })
            @ensures((_self: Foo, [value]: [string]) => { observed = value; return true; })
            m(value: string): string { return value; }
        }

        (Foo.new() as Foo).m('  padded  ');
        nodeAssert.equal(observed, 'padded');
    });

    test('`normalize: true` on @ensures replaces the result the caller receives', () => {
        class Foo extends Contracted {
            @ensures(trimmed, { normalize: true })
            m(): string { return '  padded  '; }
        }

        nodeAssert.equal((Foo.new() as Foo).m(), 'padded');
    });

    test('the first passing @demands arm decides the normalized value', () => {
        let received: unknown;

        class Foo extends Contracted {
            // Decorators register bottom-up, so the normalizing arm is declared
            // last in source order to be evaluated first.
            @demands((_self: Foo, [_value]: [string]) => true)
            @demands(trimmedArgs, { normalize: true })
            m(value: string): string { received = value; return value; }
        }

        (Foo.new() as Foo).m('  padded  ');
        nodeAssert.equal(received, 'padded', 'the first evaluated arm passed and normalized');
    });

    test('a normalizing @demands arm only applies when it is the passing one', () => {
        let received: unknown;

        class Foo extends Contracted {
            @demands(positiveArgs, { normalize: true })
            @demands((_self: Foo, [value]: [number]) => value <= 0)
            m(value: number): number { received = value; return value; }
        }

        // -5 fails `positive`, so the second arm decides and nothing normalizes.
        (Foo.new() as Foo).m(-5);
        nodeAssert.equal(received, -5);
    });

    test('more than one normalizing @ensures arm is refused at decoration time', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @ensures(trimmed, { normalize: true })
                @ensures(trimmed, { normalize: true })
                m(): string { return ''; }
            }

            void Foo;
        }, /at most one arm may normalize the result/);
    });

    test('`normalize` on a predicate arm is refused at decoration time', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @demands((() => true) as any, { normalize: true })
                m(): void { }
            }

            void Foo;
        }, /@demands cannot normalize/);
    });

    test('`normalize` on an @invariant arm is refused at decoration time', () => {
        /*
         * `@invariant` describes the instance, and no arm can replace it: a predicate
         * yields a verdict and a schema's output is discarded. Accepting `normalize`
         * here declared an intention the runtime never carried out.
         */
        nodeAssert.throws(() => {
            @invariant(positive as any, { normalize: true })
            class WithSchema extends Contracted { }

            void WithSchema;
        }, /@invariant cannot normalize/);

        nodeAssert.throws(() => {
            @invariant((() => true) as any, { normalize: true })
            class WithPredicate extends Contracted { }

            void WithPredicate;
        }, /@invariant cannot normalize/);
    });

    test('`normalize: false` on @invariant is accepted', () => {
        // The option is refused for what it would do, not for appearing.
        nodeAssert.doesNotThrow(() => {
            @invariant(positive as any, { normalize: false })
            class Foo extends Contracted { }

            void Foo;
        });
    });
});

describe('Generator steps honour normalization', () => {
    test('a normalized injected value is what the body receives', () => {
        const received: unknown[] = [];

        class Foo extends Contracted {
            @demands(trimmedArgs, { normalize: true })
            *gen(seed: string): Generator<unknown, void, string> {
                received.push(seed);

                const injected = yield seed;

                received.push(injected);
            }
        }

        const iterator = (Foo.new() as Foo).gen('  first  ');

        iterator.next();
        iterator.next('  second  ');

        nodeAssert.deepEqual(received, ['first', 'second'],
            'the call arguments and each injected value are both normalized');
    });
});

describe('Synchronous evaluation is enforced', () => {
    test('an asynchronous schema is refused with an actionable message', () => {
        const asyncSchema = schema(value => Promise.resolve(ok(value)) as any);

        class Foo extends Contracted {
            @demands(asyncSchema as any)
            m(_value: unknown): void { }
        }

        nodeAssert.throws(
            () => (Foo.new() as Foo).m(1),
            /returned a Promise; contract evaluation is synchronous, so use a synchronous schema/,
        );
    });

    test('an asynchronous @ensures schema is refused too', () => {
        const asyncSchema = schema(value => Promise.resolve(ok(value)) as any);

        class Foo extends Contracted {
            @ensures(asyncSchema as any)
            m(): number { return 1; }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).m(), /contract evaluation is synchronous/);
    });
});

describe('Schema contracts follow `checkedMode`', () => {
    test('a schema is not consulted when checked mode is disabled', () => {
        let validations = 0;

        const counting = schema(_value => {
            validations++;
            return fail('always fails');
        });

        class Foo extends Contracted {
            @demands(counting as any)
            m(_value: unknown): number { return 1; }
        }

        const foo = Foo.new() as Foo;

        (Contracted as any)[Symbol.for('Contracted.checkedMode')] = false;
        try {
            nodeAssert.equal(foo.m('anything'), 1);
            nodeAssert.equal(validations, 0);
        } finally {
            (Contracted as any)[Symbol.for('Contracted.checkedMode')] = true;
        }

        nodeAssert.throws(() => foo.m('anything'), AssertionError);
        nodeAssert.equal(validations, 1);
    });
});

describe('Predicates and schemas coexist', () => {
    test('a class may mix predicate and schema arms across its contracts', () => {
        @invariant(value => typeof (value as any)._items === 'number')
        class Basket extends Contracted {
            public _items = 0;

            @demands(schema(value => typeof (value as any)?.[0] === 'number' ? ok(value) : fail('Need a number')))
            @ensures((self: Basket) => self._items >= 0)
            add(count: number): number {
                this._items += count;

                return this._items;
            }
        }

        const basket = Basket.new() as Basket;

        nodeAssert.equal(basket.add(3), 3);
        nodeAssert.throws(() => basket.add('x' as any), /Need a number/);
    });
});
