import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant, rescue } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/318
 *
 * A generator has a boundary per *step*, not one per call. Calling the feature
 * starts nothing, and each `next()` runs the body to the following `yield`, so a
 * yield is the observable delivery that `@ensures` describes.
 *
 * The exit half of a step runs on the next resume rather than before the value is
 * handed over, because a segment is not finished at its own `yield`.
 */
describe('Contracts on generator features', () => {
    describe('`@ensures` describes each delivery', () => {
        test('every yielded step must satisfy the postcondition', () => {
            const observed: [number, number][] = [];

            @invariant(function () { return true; })
            class Counter extends Contracted {
                public _count = 0;

                @ensures(function (self: Counter, [_value]: [number], old: Counter) {
                    observed.push([old._count, self._count]);

                    return self._count === old._count + 1;
                })
                *tick(): Generator<number> {
                    this._count++;
                    yield this._count;
                    this._count++;
                    yield this._count;
                }
            }

            const counter = Counter.new() as Counter;

            nodeAssert.deepEqual([...counter.tick()], [1, 2]);
            nodeAssert.deepEqual(observed, [[0, 1], [1, 2]]);
        });

        test('a segment after the last yield is not described by `@ensures`', () => {
            const observed: number[] = [];

            @invariant(function () { return true; })
            class Counter extends Contracted {
                public _count = 0;

                @ensures(function (self: Counter, _args: any) {
                    observed.push(self._count);

                    return true;
                })
                *tick(): Generator<number> {
                    this._count++;
                    yield this._count;

                    // Runs on the resume that reports `done`; there is no value
                    // to deliver, so no postcondition applies to it.
                    this._count++;
                }
            }

            nodeAssert.deepEqual([...Counter.new().tick()], [1]);
            nodeAssert.deepEqual(observed, [1]);
        });

        test('a step that breaks the postcondition is reported with the step', () => {
            @invariant(function () { return true; })
            class Bad extends Contracted {
                public _count = 0;

                @ensures(function (self: Bad, _args: any, old: Bad) {
                    return self._count === old._count + 1;
                })
                *gen(): Generator<number> {
                    this._count += 2;   // skips past the postcondition
                    yield this._count;
                }
            }

            const iterator = (Bad.new() as Bad).gen();

            // The segment is finished when `next()` returns, so the violation is
            // reported there and the value is never handed over.
            nodeAssert.throws(() => iterator.next(), {
                name: 'AssertionError',
                message: /@ensures failed for Bad\.gen/,
            });
        });

        test('a final `return` value is not described by `@ensures`', () => {
            const observed: number[] = [];

            @invariant(function () { return true; })
            class Foo extends Contracted {
                public _count = 0;

                @ensures(function (self: Foo, _args: any) {
                    observed.push(self._count);

                    return true;
                })
                *gen(): Generator<number, string> {
                    this._count++;
                    yield this._count;

                    return 'done';
                }
            }

            const iterator = (Foo.new() as Foo).gen();

            iterator.next();
            const last = iterator.next();

            nodeAssert.deepEqual(last, { value: 'done', done: true });
            nodeAssert.deepEqual(observed, [1], '@ensures saw the yielded step only');
        });
    });

    describe('`@invariant` is checked on every resume', () => {
        test('another feature may be called between yields and never sees an invalid object', () => {
            @invariant(function (self: Ledger) { return self._balance >= 0; })
            class Ledger extends Contracted {
                public _balance = 10;

                *payments(): Generator<number> {
                    this._balance -= 6;
                    yield 6;
                    this._balance -= 6;   // would go negative
                    yield 6;
                }

                audit(): number { return this._balance; }
            }

            const ledger = Ledger.new() as Ledger;
            const iterator = ledger.payments();
            const seen: number[] = [];

            nodeAssert.deepEqual(iterator.next(), { value: 6, done: false });
            seen.push(ledger.audit());   // legitimate call between yields

            // The second segment leaves the invariant unsatisfied, and the resume
            // that would deliver it reports that instead of handing it over.
            nodeAssert.throws(() => iterator.next(), {
                name: 'AssertionError',
                message: /@invariant failed for Ledger/,
            });
            nodeAssert.deepEqual(seen, [4]);
        });

        test('the invariant brackets the traversal on entry and on completion', () => {
            let evaluations = 0;

            @invariant(function () { evaluations++; return true; })
            class Foo extends Contracted {
                *gen(): Generator<number> {
                    yield 1;
                    yield 2;
                }
            }

            const foo = Foo.new() as Foo;
            evaluations = 0;

            nodeAssert.deepEqual([...foo.gen()], [1, 2]);

            // One at the call, then an entry and an exit per step, where the
            // final step's exit is the completion check: 1 + 3 * 2.
            //
            // The exit of one step and the entry of the next are not redundant
            // with each other even though they are adjacent in the source: they
            // run in different `next()` calls, with arbitrary caller code in
            // between, which is exactly what the entry check exists to catch.
            nodeAssert.equal(evaluations, 7);
        });
    });

    describe('`@demands` describes the call', () => {
        test('it runs once, not on every step', () => {
            let evaluations = 0;

            @invariant(function () { return true; })
            class Foo extends Contracted {
                @demands(function (_self: Foo, [count]: [number]) {
                    evaluations++;

                    return count > 0;
                })
                *gen(count: number): Generator<number> {
                    for (let i = 0; i < count; i++) yield i;
                }
            }

            const foo = Foo.new() as Foo;

            nodeAssert.deepEqual([...foo.gen(3)], [0, 1, 2]);
            nodeAssert.equal(evaluations, 1, 'one call, one precondition');
        });

        test('`for...of` does not re-enter the precondition with `undefined`', () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                @demands(function (_self: Foo, [count]: [number]) { return count > 0; })
                *gen(count: number): Generator<number> {
                    for (let i = 0; i < count; i++) yield i;
                }
            }

            const foo = Foo.new() as Foo;

            // `for...of` iterates with `next()`, injecting no value
            nodeAssert.deepEqual([...foo.gen(2)], [0, 1]);
        });

        test('a value injected with `next(value)` is checked as a precondition', () => {
            @invariant(function () { return true; })
            class Echo extends Contracted {
                @demands(function (_self: Echo, [seed]: [number]) { return seed >= 0; })
                *gen(seed: number): Generator<number, number, number> {
                    let value = seed;

                    while (value >= 0) {
                        const injected = yield value;

                        if (injected === undefined) return value;

                        value = injected;
                    }

                    return value;
                }
            }

            const echo = Echo.new() as Echo;
            const iterator = echo.gen(1);

            nodeAssert.deepEqual(iterator.next(), { value: 1, done: false });
            nodeAssert.deepEqual(iterator.next(5), { value: 5, done: false });

            nodeAssert.throws(() => iterator.next(-1), {
                name: 'AssertionError',
                message: /@demands failed for Echo\.gen/,
            });
        });
    });

    describe('`@rescue` covers the traversal', () => {
        test('a throw escaping a step is rescued', () => {
            let rescued = false;

            @invariant(function () { return true; })
            class Foo extends Contracted {
                @rescue(function () { rescued = true; })
                *gen(): Generator<number> {
                    yield 1;
                    throw new Error('boom');
                }
            }

            const foo = Foo.new() as Foo;
            const iterator = foo.gen();

            nodeAssert.equal(iterator.next().value, 1);
            nodeAssert.throws(() => iterator.next(), { message: 'boom' });
            nodeAssert.equal(rescued, true);
        });

        test('`retry` restarts the traversal', () => {
            let attempts = 0;

            @invariant(function () { return true; })
            class Foo extends Contracted {
                @rescue(function (_self, _error, args, retry) {
                    retry(...args);
                }, { maxRetries: 1 })
                *gen(): Generator<number> {
                    attempts++;

                    if (attempts === 1) throw new Error('first traversal fails');
                    yield attempts;
                }
            }

            const foo = Foo.new() as Foo;

            // The retried traversal produced a value, so the caller gets it.
            nodeAssert.deepEqual([...foo.gen()], [2]);
            nodeAssert.equal(attempts, 2);
        });

        test('a retried traversal that fails again honours `maxRetries`', () => {
            let handlerRuns = 0;

            @invariant(function () { return true; })
            class Foo extends Contracted {
                @rescue(function (_self, _error, _args, retry) {
                    handlerRuns++;
                    retry();
                }, { maxRetries: 2 })
                *gen(): Generator<number> {
                    // Never yields: the traversal fails before producing a value.
                    if (handlerRuns >= 0) throw new Error('always');

                    yield 0;
                }
            }

            nodeAssert.throws(() => (Foo.new() as Foo).gen().next(), { message: 'always' });
            nodeAssert.equal(handlerRuns, 2);
        });
    });

    describe('iterator protocol is preserved', () => {
        test('the wrapper is a generator iterator', () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                *gen(): Generator<number> { yield 1; }
            }

            const iterator = (Foo.new() as Foo).gen();

            nodeAssert.equal(typeof iterator[Symbol.iterator], 'function');
            nodeAssert.equal(iterator[Symbol.iterator](), iterator);
        });

        test('an early `return` ends the traversal', () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                *gen(): Generator<number> {
                    yield 1;
                    yield 2;
                }
            }

            const iterator = (Foo.new() as Foo).gen();

            nodeAssert.equal(iterator.next().value, 1);
            nodeAssert.deepEqual(iterator.return(99), { value: 99, done: true });
            nodeAssert.deepEqual(iterator.next(), { value: undefined, done: true });
        });

        test('`break` in a loop ends the traversal cleanly', () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                *gen(): Generator<number> {
                    yield 1;
                    yield 2;
                }
            }

            for (const value of (Foo.new() as Foo).gen()) {
                nodeAssert.equal(value, 1);
                break;
            }
        });
    });

    describe('async generators', () => {
        test('each delivery must satisfy the postcondition', async () => {
            const observed: number[] = [];

            @invariant(function () { return true; })
            class Foo extends Contracted {
                public _count = 0;

                @ensures(function (self: Foo, _args: any, old: Foo) {
                    observed.push(self._count);

                    return self._count === old._count + 1;
                })
                async *gen(): AsyncGenerator<number> {
                    this._count++;
                    yield this._count;
                    await Promise.resolve();
                    this._count++;
                    yield this._count;
                }
            }

            const collected: number[] = [];

            for await (const value of (Foo.new() as Foo).gen()) collected.push(value);

            nodeAssert.deepEqual(collected, [1, 2]);
            nodeAssert.deepEqual(observed, [1, 2]);
        });

        test('the invariant is checked on every resume', async () => {
            @invariant(function (self: Foo) { return self._balance >= 0; })
            class Foo extends Contracted {
                public _balance = 10;

                async *gen(): AsyncGenerator<number> {
                    this._balance -= 6;
                    yield 6;
                    this._balance -= 6;
                    yield 6;
                }
            }

            const foo = Foo.new() as Foo;
            const iterator = foo.gen();

            nodeAssert.deepEqual(await iterator.next(), { value: 6, done: false });
            await nodeAssert.rejects(() => iterator.next(), {
                name: 'AssertionError',
                message: /@invariant failed for Foo/,
            });
        });

        test('the wrapper is an async iterator', () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                async *gen(): AsyncGenerator<number> { yield 1; }
            }

            const iterator = (Foo.new() as Foo).gen();

            nodeAssert.equal(typeof iterator[Symbol.asyncIterator], 'function');
            nodeAssert.equal(iterator[Symbol.asyncIterator](), iterator);
        });
    });
});
