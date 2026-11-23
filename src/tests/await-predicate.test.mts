import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant, rescue } from '@final-hill/decorator-contracts';
import type { StandardSchemaV1 } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/362
 *
 * A contract predicate must answer with a boolean, which is right for a
 * synchronous feature and wrong for one whose exit boundary is already a promise.
 * `awaitPredicate` moves the verdict to the same microtask the exit checks
 * occupy, and it is refused everywhere that cannot happen.
 *
 * Awaiting decides only *when* a verdict arrives, not what it means: a predicate
 * that cannot answer — whether it threw or rejected — is a failed arm, so a
 * sibling `@demands` arm may nonetheless permit the call, and every arm failing is
 * what raises.
 */

/** A hand-rolled schema, so the suite proves the refusal needs no provider. */
const schema = <Input,>(
    validate: (value: unknown) => StandardSchemaV1.Result<unknown>,
): StandardSchemaV1<Input, unknown> => ({
    '~standard': { version: 1, vendor: 'hand-rolled', validate },
});

/** Captures the value a rejected call raises, which `rejects` discards. */
const rejection = async (call: () => unknown): Promise<any> => {
    try {
        await call();
    } catch (error) {
        return error;
    }

    throw new Error('expected the call to reject');
};

/** An error a predicate deliberately raises, to prove it survives unchanged. */
class Denied extends Error { }

describe('An awaited predicate on an async feature', () => {
    describe('`@demands`', () => {
        test('a satisfied awaited predicate permits the call', async () => {
            @invariant(() => true)
            class Account extends Contracted {
                public _balance = 10;

                @demands(
                    async ({ self, args: [amount] }) => self._balance - amount >= 0,
                    { awaitPredicate: true },
                )
                async withdraw(amount: number): Promise<void> {
                    await Promise.resolve();
                    this._balance -= amount;
                }
            }

            const account = Account.new() as Account;

            await account.withdraw(4);
            nodeAssert.equal(account._balance, 6);
        });

        test('an unsatisfied awaited predicate rejects with the contract failure', async () => {
            @invariant(() => true)
            class Account extends Contracted {
                public _balance = 10;

                @demands(
                    async ({ self, args: [amount] }) => self._balance - amount >= 0,
                    { awaitPredicate: true },
                )
                async withdraw(amount: number): Promise<void> {
                    await Promise.resolve();
                    this._balance -= amount;
                }
            }

            const account = Account.new() as Account;

            await nodeAssert.rejects(() => account.withdraw(20), {
                name: 'AssertionError',
                message: /@demands failed for Account\.withdraw/,
            });
            nodeAssert.equal(account._balance, 10, 'the body never ran');
        });

        test('the predicate is awaited before the body starts', async () => {
            const order: string[] = [];

            @invariant(() => true)
            class Foo extends Contracted {
                @demands(
                    async () => {
                        await Promise.resolve();
                        order.push('predicate');

                        return true;
                    },
                    { awaitPredicate: true },
                )
                async m(): Promise<void> {
                    order.push('body');
                }
            }

            await (Foo.new() as Foo).m();

            nodeAssert.deepEqual(order, ['predicate', 'body']);
        });

        test('the instance is read-only inside an awaited predicate', async () => {
            @invariant(() => true)
            class Foo extends Contracted {
                public _value = 0;

                @demands(
                    async ({ self }) => {
                        await Promise.resolve();
                        (self as any)._value = 5;

                        return true;
                    },
                    { awaitPredicate: true },
                )
                async m(): Promise<void> { }
            }

            const foo = Foo.new() as Foo;

            await nodeAssert.rejects(() => foo.m(), /may not assign '_value'/);
            nodeAssert.equal(foo._value, 0);
        });
    });

    describe('`@ensures`', () => {
        test('a satisfied awaited postcondition is checked after the body settles', async () => {
            @invariant(() => true)
            class Account extends Contracted {
                public _balance = 0;

                @ensures(
                    async ({ self, args: [amount], old }) => self._balance === old._balance + amount,
                    { awaitPredicate: true },
                )
                async deposit(amount: number): Promise<void> {
                    await Promise.resolve();
                    this._balance += amount;
                }
            }

            const account = Account.new() as Account;

            await account.deposit(5);
            nodeAssert.equal(account._balance, 5);
        });

        test('an awaited postcondition the body breaks rejects', async () => {
            @invariant(() => true)
            class Account extends Contracted {
                public _balance = 0;

                @ensures(
                    async ({ self, args: _args, old }) => self._balance === old._balance,
                    { awaitPredicate: true },
                )
                async mutate(): Promise<void> {
                    await Promise.resolve();
                    this._balance = 99;
                }
            }

            const account = Account.new() as Account;

            await nodeAssert.rejects(() => account.mutate(), {
                name: 'AssertionError',
                message: /@ensures failed for Account\.mutate/,
            });
        });

        test('every awaited arm is evaluated, because `@ensures` is AND-composed', async () => {
            const observed: number[] = [];

            @invariant(() => true)
            class Foo extends Contracted {
                public _value = 0;

                @ensures(
                    async ({ result }) => {
                        await Promise.resolve();
                        observed.push(result as number);

                        return true;
                    },
                    { awaitPredicate: true },
                )
                @ensures(
                    async () => {
                        await Promise.resolve();
                        observed.push(-1);

                        return false;
                    },
                    { awaitPredicate: true },
                )
                async m(): Promise<number> {
                    this._value = 1;

                    return 42;
                }
            }

            await nodeAssert.rejects(() => (Foo.new() as Foo).m(), {
                name: 'AssertionError',
                message: /1 of 2 predicates unsatisfied/,
            });
            nodeAssert.deepEqual(observed, [-1, 42], 'both arms ran, the failing one recorded');
        });
    });

    describe('what a verdict means is unaffected by awaiting', () => {
        test('a rejected predicate is a failed arm, so a sibling arm may permit the call', async () => {
            @invariant(() => true)
            class Foo extends Contracted {
                @demands(() => true)
                @demands(
                    async () => { throw new Denied('cannot answer'); },
                    { awaitPredicate: true },
                )
                async m(): Promise<void> { }
            }

            const foo = Foo.new() as Foo;

            // The rejecting arm is evaluated first, then the permitting one. A
            // rejection that aborted the composition would deny a call the contract
            // permits.
            await foo.m();
        });

        test('when every arm fails the rejection is raised instead of an AssertionError', async () => {
            @invariant(() => true)
            class Foo extends Contracted {
                @demands(
                    async () => { throw new Denied('cannot answer'); },
                    { awaitPredicate: true },
                )
                async m(): Promise<void> { }
            }

            const raised = await rejection(() => (Foo.new() as Foo).m());

            nodeAssert.equal(raised instanceof Denied, true, 'the declared error survives');
            nodeAssert.equal(raised.violation.contract, '@demands');
            nodeAssert.deepEqual(raised.violation.thrownIndices, [0]);
        });

        test('a resolution that is not a boolean is refused', async () => {
            @invariant(() => true)
            class Foo extends Contracted {
                @demands(async () => 1 as any, { awaitPredicate: true })
                async m(): Promise<void> { }
            }

            await nodeAssert.rejects(() => (Foo.new() as Foo).m(), {
                name: 'AssertionError',
                message: /returned a number \(1\); contract predicates must return a boolean/,
            });
        });

        test('an arm that declared no option is refused even beside an awaited one', async () => {
            @invariant(() => true)
            class Foo extends Contracted {
                // Evaluated last, so the awaited arm runs first and the contract is
                // already on the awaited path when this arm is decided.
                @demands((async () => Promise.resolve(true)) as any)
                @demands(async () => false, { awaitPredicate: true })
                async m(): Promise<void> { }
            }

            await nodeAssert.rejects(() => (Foo.new() as Foo).m(), {
                name: 'AssertionError',
                message: '@demands predicate #2 for Foo.m returned a Promise '
                    + '(contract predicates must be synchronous); contract predicates must return a boolean',
            });
        });
    });

    describe('a normalizing schema composes with an awaited arm', () => {
        test('`@demands` replaces the arguments when the schema arm runs first', async () => {
            const magnitude = schema<[number]>(value => ({
                value: [Math.abs((value as number[])[0])],
            }));

            @invariant(() => true)
            class Foo extends Contracted {
                public _seen = Number.NaN;

                // The schema is the bottom decorator, so it is evaluated first and
                // decides the arguments the body receives.
                @demands(async () => true, { awaitPredicate: true })
                @demands(magnitude, { normalize: true })
                async m(n: number): Promise<void> { this._seen = n; }
            }

            const foo = Foo.new() as Foo;

            await foo.m(-5);
            nodeAssert.equal(foo._seen, 5);
        });

        test('`@ensures` replaces the result when the schema arm normalizes', async () => {
            const tagged = schema<unknown>(value => ({ value: `v:${String(value)}` }));

            @invariant(() => true)
            class Foo extends Contracted {
                @ensures(async () => true, { awaitPredicate: true })
                @ensures(tagged, { normalize: true })
                async m(): Promise<number> { return 7; }
            }

            nodeAssert.equal(await (Foo.new() as Foo).m(), 'v:7');
        });
    });

    describe('the exit checks stay in the tick the body settles in', () => {
        test('a synchronous `@ensures` does not push the exit `@invariant` past a microtask', async () => {
            const order: string[] = [];

            @invariant(() => { order.push('invariant'); return true; })
            class Foo extends Contracted {
                @ensures(() => { order.push('ensures'); return true; })
                async m(): Promise<void> { order.push('body'); }
            }

            const foo = Foo.new() as Foo;

            order.length = 0;

            const pending = foo.m();

            // Queued after the body has started, so it runs after the body settles.
            // The exit checks belong to that same tick: a caller resuming here must
            // not observe state the exit invariant has not approved.
            queueMicrotask(() => order.push('competing'));

            await pending;
            order.push('caller');

            nodeAssert.deepEqual(order, ['invariant', 'body', 'ensures', 'invariant', 'competing', 'caller']);
        });

        test('the exit `@invariant` still runs after an awaited postcondition', async () => {
            @invariant(({ self }) => self._value <= 1)
            class Foo extends Contracted {
                public _value = 0;

                @ensures(async () => true, { awaitPredicate: true })
                async m(): Promise<void> {
                    await Promise.resolve();
                    this._value = 99;   // breaks the invariant
                }
            }

            await nodeAssert.rejects(() => (Foo.new() as Foo).m(), {
                name: 'AssertionError',
                message: /@invariant failed for Foo/,
            });
        });
    });

    describe('the extra await boundary is visible', () => {
        test('another feature may observe the instance while the precondition is pending', async () => {
            let release!: () => void;
            const gate = new Promise<void>(resolve => { release = resolve; });

            @invariant(({ self }) => self._value >= 0)
            class Foo extends Contracted {
                public _value = 0;

                @demands(
                    async ({ self }) => {
                        await gate;

                        return self._value === 0;
                    },
                    { awaitPredicate: true },
                )
                async bump(): Promise<void> {
                    this._value = 1;
                }

                async read(): Promise<number> {
                    return this._value;
                }
            }

            const foo = Foo.new() as Foo;
            const pending = foo.bump();

            // The precondition has suspended and the body has not started, so the
            // instance is observable in the state the precondition is about to approve.
            nodeAssert.equal(await foo.read(), 0);

            release();
            await pending;

            nodeAssert.equal(await foo.read(), 1);
        });

        test('a rejected precondition does not reach `@rescue`, for the reason a throw does not', async () => {
            let rescued = 0;

            @invariant(() => true)
            class Foo extends Contracted {
                @rescue(() => { rescued++; })
                @demands(async () => false, { awaitPredicate: true })
                async m(): Promise<void> { }
            }

            await nodeAssert.rejects(() => (Foo.new() as Foo).m(), { name: 'AssertionError' });
            nodeAssert.equal(rescued, 0, 'a precondition has no body for a retry to resume');
        });
    });
});

describe('The option is refused where nothing can await it', () => {
    test('a synchronous feature refuses it at decoration time', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @demands(async () => true, { awaitPredicate: true })
                m(): void { }
            }

            return Foo;
        }, /@demands cannot declare awaitPredicate on this feature/);
    });

    test('a getter and a setter refuse it at decoration time', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @demands(async () => true, { awaitPredicate: true })
                get value(): number { return 0; }
            }

            return Foo;
        }, /@demands cannot declare awaitPredicate on a getter/);

        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @demands(async () => true, { awaitPredicate: true })
                set value(_v: number) { }
            }

            return Foo;
        }, /@demands cannot declare awaitPredicate on a setter/);
    });

    test('a generator refuses it, naming the per-step boundary', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @demands(async () => true, { awaitPredicate: true })
                *gen(): Generator<number> { yield 1; }
            }

            return Foo;
        }, /a generator has one contract boundary per step/);
    });

    test('an async generator refuses it too', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @demands(async () => true, { awaitPredicate: true })
                async *gen(): AsyncGenerator<number> { yield 1; }
            }

            return Foo;
        }, /a generator has one contract boundary per step/);
    });

    test('`@invariant` refuses it', () => {
        nodeAssert.throws(() => {
            // The arm type refuses the promise, which is the first line of defence;
            // the decoration-time check is what a consumer without type checking meets.
            @invariant((async () => true) as any, { awaitPredicate: true })
            class Foo extends Contracted { }

            return Foo;
        }, /@invariant cannot declare awaitPredicate/);
    });

    test('a schema arm refuses it, because `validate` is synchronous', () => {
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @demands(schema(() => ({ value: [] })), { awaitPredicate: true })
                async m(): Promise<void> { }
            }

            return Foo;
        }, /@demands cannot declare awaitPredicate on a schema arm/);
    });

    test('an inherited declaration is refused at the boundary it cannot honour', () => {
        @invariant(() => true)
        class Base extends Contracted {
            @demands(async ({ args: [n] }) => n > 0, { awaitPredicate: true })
            async run(n: number): Promise<number> { return n; }
        }

        // A subclass may replace an `async` feature with a synchronous one; the
        // inherited metadata record carries the base's awaited arm, and this
        // boundary cannot wait for it.
        class Sub extends Base {
            override run(n: number): any { return n; }
        }

        const sub = Sub.new() as Sub;

        nodeAssert.throws(() => sub.run(1), /declared awaitPredicate but returned a Promise/);
    });

    test('`awaitPredicate: false` is accepted, because it asks for nothing', async () => {
        @invariant(() => true)
        class Foo extends Contracted {
            @demands(() => true, { awaitPredicate: false })
            async m(): Promise<void> { }
        }

        await (Foo.new() as Foo).m();
    });
});

describe('Without the option, an asynchronous predicate is refused', () => {
    test('on a synchronous feature, with the existing message', () => {
        class Foo extends Contracted {
            @demands(() => Promise.resolve(true) as any)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method(), {
            name: 'AssertionError',
            message: '@demands predicate #1 for Foo.method returned a Promise '
                + '(contract predicates must be synchronous); contract predicates must return a boolean',
        });
    });

    test('on an async feature, with the same message', async () => {
        @invariant(() => true)
        class Foo extends Contracted {
            @demands(() => Promise.resolve(true) as any)
            async m(): Promise<void> { }
        }

        await nodeAssert.rejects(() => (Foo.new() as Foo).m(), {
            name: 'AssertionError',
            message: '@demands predicate #1 for Foo.m returned a Promise '
                + '(contract predicates must be synchronous); contract predicates must return a boolean',
        });
    });

    test('a `@ensures` predicate is refused the same way', async () => {
        @invariant(() => true)
        class Foo extends Contracted {
            @ensures(() => Promise.resolve(true) as any)
            async m(): Promise<void> { }
        }

        await nodeAssert.rejects(() => (Foo.new() as Foo).m(), {
            name: 'AssertionError',
            message: '@ensures predicate #1 for Foo.m returned a Promise '
                + '(contract predicates must be synchronous); contract predicates must return a boolean',
        });
    });
});
