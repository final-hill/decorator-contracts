import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant, rescue } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/191
 *
 * A predicate answers a question, so it must not be able to change the state it
 * is asked about. A write in a predicate is corrupting rather than merely impure:
 * the predicate runs between the entry and exit `@invariant`, so it can hide a
 * violation the invariant would otherwise have reported.
 *
 * `rescue` is deliberately exempt — restoring corrupted state is its purpose.
 */
describe('Contract predicates may not mutate the instance', () => {
    describe('assignment is refused', () => {
        test('@demands cannot assign to the instance', () => {
            class Foo extends Contracted {
                public _value = 0;

                @demands(function ({ self }) {
                    try {
                        self._value = 999;

                        return true;
                    } catch {
                        return true;
                    }
                })
                read(): number { return this._value; }
            }

            const foo = Foo.new() as Foo;

            foo.read();
            nodeAssert.equal(foo._value, 0, 'the predicate must not have written');
        });

        test('an assignment in a predicate throws a TypeError naming the property', () => {
            let message = '';

            class Foo extends Contracted {
                public _value = 0;

                @demands(function ({ self }) {
                    try {
                        self._value = 1;
                    } catch (error) {
                        message = (error as Error).message;
                    }

                    return true;
                })
                read(): void { }
            }

            (Foo.new() as Foo).read();
            nodeAssert.match(message, /may not assign '_value'/);
        });

        test('@invariant cannot assign to the instance', () => {
            @invariant(function ({ self }) {
                try {
                    self._value = -1;
                } catch {
                    // expected
                }

                return self._value > 0;
            })
            class Foo extends Contracted {
                public _value = 1;

                read(): number { return this._value; }
            }

            const foo = Foo.new() as Foo;

            foo.read();
            nodeAssert.equal(foo._value, 1);
        });

        test('@ensures cannot assign to the instance', () => {
            class Foo extends Contracted {
                public _value = 0;

                @ensures(function ({ self }) {
                    try {
                        self._value = 42;
                    } catch {
                        // expected
                    }

                    return true;
                })
                write(): void { this._value = 1; }
            }

            const foo = Foo.new() as Foo;

            foo.write();
            nodeAssert.equal(foo._value, 1, 'only the body wrote');
        });
    });

    describe('deletion and property definition are refused', () => {
        test('a predicate cannot delete an instance property', () => {
            let message = '';

            class Foo extends Contracted {
                public _value = 1;

                @demands(function ({ self }) {
                    try {
                        delete (self as any)._value;
                    } catch (error) {
                        message = (error as Error).message;
                    }

                    return true;
                })
                read(): void { }
            }

            (Foo.new() as Foo).read();
            nodeAssert.match(message, /may not delete '_value'/);
        });

        test('a predicate cannot define a property on the instance', () => {
            let message = '';

            class Foo extends Contracted {
                @demands(function ({ self }) {
                    try {
                        Object.defineProperty(self, 'injected', { value: 1 });
                    } catch (error) {
                        message = (error as Error).message;
                    }

                    return true;
                })
                read(): void { }
            }

            (Foo.new() as Foo).read();
            nodeAssert.match(message, /may not define properties/);
        });
    });

    describe('reading is unaffected', () => {
        test('a predicate can read fields, getters, and call methods', () => {
            let observed: unknown;

            class Foo extends Contracted {
                public _value = 3;
                get doubled() { return this._value * 2; }
                triple(): number { return this._value * 3; }

                @demands(function ({ self }) {
                    observed = [self._value, self.doubled, self.triple()];

                    return true;
                })
                read(): void { }
            }

            (Foo.new() as Foo).read();
            nodeAssert.deepEqual(observed, [3, 6, 9]);
        });

        test('`instanceof` still identifies the instance', () => {
            let isFoo: boolean | undefined;

            @invariant(function ({ self }) {
                isFoo ??= self instanceof Foo;

                return true;
            })
            class Foo extends Contracted {
                read(): void { }
            }

            (Foo.new() as Foo).read();
            nodeAssert.equal(isFoo, true);
        });

        test('an `@ensures` predicate can still compare `old` against `self`', () => {
            const seen: boolean[] = [];

            class Child { public id = 1; }

            class Holder extends Contracted {
                // A class instance is shared by reference between `old` and `self`;
                // a plain object would be cloned by `cloneState`, which is why the
                // comparison below uses one.
                public _child = new Child();
                public _value = 0;

                @ensures(function ({ self, args: [delta], old  }) {
                    seen.push(old._child === self._child, self._value === old._value + delta);

                    return true;
                })
                bump(delta: number): void { this._value += delta; }
            }

            (Holder.new() as Holder).bump(1);
            nodeAssert.deepEqual(seen, [true, true]);
        });
    });

    describe('the feature body is not restricted', () => {
        test('the body can still mutate after a predicate was evaluated', () => {
            // `Object.freeze` would break this: the instance would stay frozen for
            // the body, so every later feature would fail. The guard is scoped to
            // the predicate call instead.
            class Account extends Contracted {
                public _balance = 0;

                @demands(function ({ self }) {
                    try {
                        self._balance = 999;
                    } catch {
                        // expected
                    }

                    return true;
                })
                deposit(amount: number): void { this._balance += amount; }
            }

            const account = Account.new() as Account;

            account.deposit(10);
            nodeAssert.equal(account._balance, 10);

            account.deposit(5);
            nodeAssert.equal(account._balance, 15);
        });
    });

    describe('`@rescue` may still restore state', () => {
        test('a rescue handler receives the raw instance and can fix it', () => {
            class Foo extends Contracted {
                public _value = 5;

                @rescue(function ({ self }) {
                    // Restoring corrupted state is the whole point of @rescue.
                    self._value = 0;
                })
                @ensures(function ({ self }) {
                    return self._value === 0 || self._value === 5;
                })
                breakIt(): void {
                    this._value = 99;
                    throw new Error('boom');
                }
            }

            const foo = Foo.new() as Foo;

            nodeAssert.throws(() => foo.breakIt());
            nodeAssert.equal(foo._value, 0, 'the handler restored the state');
        });
    });

    describe('the README examples are executable', () => {
        test('the documented TypeError is what a predicate receives', () => {
            let observed = '';

            class Foo extends Contracted {
                public _value = 1;

                @demands(function ({ self }) {
                    try {
                        self._value = 0;
                    } catch (error) {
                        observed = (error as Error).message;
                    }

                    return true;
                })
                read(): void { }
            }

            (Foo.new() as Foo).read();
            nodeAssert.match(observed, /A contract predicate may not assign '_value'/);
        });

        test('a nested mutation is not intercepted, as documented', () => {
            class Foo extends Contracted {
                public _items: number[] = [];

                @demands(function ({ self }) {
                    // Documented as out of scope: the guard covers the instance's
                    // own surface, not values it points at.
                    self._items.push(1);

                    return true;
                })
                read(): void { }
            }

            const foo = Foo.new() as Foo;

            foo.read();
            nodeAssert.deepEqual(foo._items, [1]);
        });
    });

    describe('the guard is scoped to predicates', () => {
        test('a schema arm still validates the real instance', () => {
            const schema = {
                '~standard': {
                    version: 1 as const,
                    vendor: 'test',
                    validate: (value: unknown) =>
                        typeof (value as any)?._value === 'number'
                            ? { value }
                            : { issues: [{ message: 'expected a value' }] },
                },
            };

            @invariant(schema as any)
            class Foo extends Contracted {
                public _value = 1;

                read(): number { return this._value; }
            }

            nodeAssert.equal((Foo.new() as Foo).read(), 1);
        });
    });
});
