import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant, rescue } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/188
 *
 * An `async` body returns its promise from `Reflect.apply` before a single line
 * of it has run. The contract lifecycle must therefore follow the value and
 * evaluate `@ensures` and the exit `@invariant` after the promise settles, or a
 * postcondition is checked against a body that has not executed.
 */
describe('Contracts on async features', () => {
    describe('the exit boundary follows the promise', () => {
        test('`@ensures` observes state the body changed after an `await`', async () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                public _value = 0;

                @ensures(function (self: Foo, [delta]: [number], old: Foo) {
                    return self._value === old._value + delta;
                })
                async add(delta: number): Promise<number> {
                    await Promise.resolve();
                    this._value += delta;

                    return this._value;
                }
            }

            const foo = Foo.new() as Foo;

            nodeAssert.equal(await foo.add(5), 5);
            nodeAssert.equal(foo._value, 5);
        });

        test('a postcondition the body breaks is reported, not passed vacuously', async () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                public _value = 0;

                @ensures(function (self: Foo, _args: [], old: Foo) {
                    // Deliberately claims the feature is a no-op
                    return self._value === old._value;
                })
                async mutates(): Promise<void> {
                    await Promise.resolve();
                    this._value = 999;
                }
            }

            const foo = Foo.new() as Foo;

            await nodeAssert.rejects(() => foo.mutates(), {
                name: 'AssertionError',
                message: /@ensures failed for Foo\.mutates/,
            });
            nodeAssert.equal(foo._value, 999);
        });

        test('the exit `@invariant` runs after the body settles', async () => {
            @invariant(function (self: Foo) { return self._value <= 10; })
            class Foo extends Contracted {
                public _value = 0;

                async blowUp(): Promise<void> {
                    await Promise.resolve();
                    this._value = 999;
                }
            }

            const foo = Foo.new() as Foo;

            await nodeAssert.rejects(() => foo.blowUp(), {
                name: 'AssertionError',
                message: /@invariant failed for Foo/,
            });
        });

        test('`old` is the state from before the body ran', async () => {
            const seen: number[] = [];

            @invariant(function () { return true; })
            class Foo extends Contracted {
                public _value = 0;

                @ensures(function (_self: Foo, _args: [], old: Foo) {
                    seen.push(old._value);

                    return true;
                })
                async add(delta: number): Promise<void> {
                    await Promise.resolve();
                    this._value += delta;
                }
            }

            const foo = Foo.new() as Foo;

            await foo.add(1);
            await foo.add(2);
            nodeAssert.deepEqual(seen, [0, 1]);
        });
    });

    describe('failure is delivered as a rejection', () => {
        test('an unsatisfied `@demands` on an async feature rejects', async () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                @demands(function (_self: Foo, [delta]: [number]) { return delta > 0; })
                async add(delta: number): Promise<number> { return delta; }
            }

            const foo = Foo.new() as Foo;

            // The body of an `async` function never throws synchronously, so a
            // precondition violation must not either.
            await nodeAssert.rejects(() => foo.add(-1), {
                name: 'AssertionError',
                message: /@demands failed for Foo\.add/,
            });
        });

        test('an unsatisfied entry `@invariant` on an async feature rejects', async () => {
            @invariant(function (self: Foo) { return self._value >= 0; })
            class Foo extends Contracted {
                public _value = 0;

                async read(): Promise<number> { return this._value; }
            }

            const foo = Foo.new() as Foo;

            // Corrupt state below the proxy, which is documented as the one way
            // to bypass the traps
            Object.defineProperty(foo, '_value', { value: -1, writable: true, configurable: true, enumerable: true });

            await nodeAssert.rejects(() => foo.read(), {
                name: 'AssertionError',
                message: /@invariant failed for Foo/,
            });
        });

        test('the caller never receives a synchronously thrown contract error', async () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                @demands(function () { return false; })
                async m(): Promise<void> { }
            }

            const foo = Foo.new() as Foo;

            // A synchronous throw here would change the failure surface of the
            // feature purely because a contract was added to it.
            const result = foo.m();

            nodeAssert.equal(typeof result.then, 'function');
            await nodeAssert.rejects(() => result, { name: 'AssertionError' });
        });
    });

    describe('`@rescue` observes rejections', () => {
        test('a handler runs when the async body rejects', async () => {
            let observations = 0;

            @invariant(function () { return true; })
            class Foo extends Contracted {
                @rescue(function () { observations++; })
                async fails(): Promise<void> { throw new Error('boom'); }
            }

            const foo = Foo.new() as Foo;

            await nodeAssert.rejects(() => foo.fails(), { message: 'boom' });
            nodeAssert.equal(observations, 1);
        });

        test('`retry` restarts the lifecycle for an async feature', async () => {
            let attempts = 0;

            @invariant(function () { return true; })
            class Foo extends Contracted {
                public _attempts = 0;

                @rescue(function (self: Foo, _error, _args, retry) {
                    self._attempts++;

                    retry();
                }, { maxRetries: 1 })
                async works(): Promise<string> {
                    attempts++;

                    if (attempts === 1) throw new Error('first attempt fails');

                    return 'recovered';
                }
            }

            const foo = Foo.new() as Foo;

            nodeAssert.equal(await foo.works(), 'recovered');
            nodeAssert.equal(attempts, 2);
        });

        test('a rejected retry re-enters the handler and honours `maxRetries`', async () => {
            let handlerRuns = 0;

            @invariant(function () { return true; })
            class Foo extends Contracted {
                @rescue(function (_self, _error, _args, retry) {
                    handlerRuns++;
                    retry();
                }, { maxRetries: 2 })
                async alwaysFails(): Promise<void> { throw new Error('always'); }
            }

            const foo = Foo.new() as Foo;

            await nodeAssert.rejects(() => foo.alwaysFails(), { message: 'always' });
            nodeAssert.equal(handlerRuns, 2, 'the handler runs once per retry');
        });

        test('a postcondition failure is rescuable, like a sync one', async () => {
            let rescued = false;

            @invariant(function () { return true; })
            class Foo extends Contracted {
                public _value = 0;

                @rescue(function (self: Foo) {
                    rescued = true;
                    self._value = 0;
                })
                @ensures(function (self: Foo, _args: [], old: Foo) {
                    return self._value === old._value;
                })
                async mutate(): Promise<void> {
                    await Promise.resolve();
                    this._value = 42;
                }
            }

            const foo = Foo.new() as Foo;

            await nodeAssert.rejects(() => foo.mutate(), { name: 'AssertionError' });
            nodeAssert.equal(rescued, true);
        });
    });

    describe('a synchronous feature that returns a thenable fails closed', () => {
        test('the call throws the contract instead of checking a pending body', () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                public _value = 0;

                @ensures(function (self: Foo, _args: [], old: Foo) {
                    return self._value === old._value + 1;
                })
                thenable(): Promise<void> {
                    return (async () => {
                        await Promise.resolve();
                        this._value++;
                    })();
                }
            }

            const foo = Foo.new() as Foo;

            // The feature is synchronous, so its contracts are evaluated
            // synchronously; the failure surface must stay synchronous too.
            nodeAssert.throws(() => foo.thenable(), {
                name: 'AssertionError',
                message: /Foo\.thenable returned a promise but is not declared 'async'/,
            });
        });

        test('a non-async feature may still return a non-thenable value', () => {
            @invariant(function () { return true; })
            class Foo extends Contracted {
                @ensures(function () { return true; })
                plain(): number { return 1; }
            }

            nodeAssert.equal((Foo.new() as Foo).plain(), 1);
        });
    });

    describe('the invariant still brackets an async call exactly once', () => {
        test('the invariant is evaluated twice per successful async call', async () => {
            let evaluations = 0;

            @invariant(function () { evaluations++; return true; })
            class Foo extends Contracted {
                async work(): Promise<void> { await Promise.resolve(); }
            }

            const foo = Foo.new() as Foo;
            evaluations = 0;

            await foo.work();
            nodeAssert.equal(evaluations, 2);
        });
    });
});
