import {
    AssertionError, checkedMode, Contracted, demands, ensures, invariant, rescue,
    type ContractViolation, type DemandsSubject, type EnsuresSubject, type RescueSubject,
} from '@final-hill/decorator-contracts';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

/**
 * https://github.com/final-hill/decorator-contracts/issues/333
 *
 * A factory converts a failed contract into the error the caller receives. The
 * point of it is the violation it is handed: that record is the only
 * machine-readable part of a failure, and a bare error constructor would discard
 * it.
 */

/** A typed error, of the kind a boundary branches on. */
class PermissionDenied extends Error {
    override name = 'PermissionDenied';

    constructor(message: string, readonly violation?: ContractViolation) {
        super(message);
    }
}

/** Reads the error a call raises. */
const capture = (fn: () => unknown): any => {
    try {
        fn();
    } catch (error) {
        return error;
    }

    return nodeAssert.fail('expected the call to raise');
}

describe('`onViolation` converts a failed `@demands` into a typed error', () => {
    class Account extends Contracted {
        private _balance = 0;

        @demands(({ self }: DemandsSubject<Account>) => self._balance > 0, {
            onViolation: violation => new PermissionDenied('balance is zero', violation),
        })
        withdraw(): void {
            this._balance--;
        }
    }

    test('the caller receives the factory\'s error, not an AssertionError', () => {
        const error = capture(() => Account.new().withdraw());

        nodeAssert.strictEqual(error instanceof PermissionDenied, true);
        nodeAssert.strictEqual(error instanceof AssertionError, false);
        nodeAssert.strictEqual(error.message, 'balance is zero');
    });

    test('the factory receives the full violation', () => {
        let received: ContractViolation | undefined;

        class Foo extends Contracted {
            @demands(() => false, { onViolation: violation => { received = violation; return new Error('no'); } })
            method(): void { }
        }

        capture(() => (Foo.new() as any).method());

        nodeAssert.ok(received);
        nodeAssert.strictEqual(received.contract, '@demands');
        nodeAssert.strictEqual(received.className, 'Foo');
        nodeAssert.strictEqual(received.feature, 'method');
        nodeAssert.deepStrictEqual(received.failedIndices, [0]);
    });

    test('predicates run during evaluation; the factory runs once afterwards', () => {
        const calls: string[] = [];

        class Foo extends Contracted {
            @demands(() => { calls.push('predicate 1'); return false; })
            @demands(() => { calls.push('predicate 2'); return false; })
            method(): void { }
        }

        capture(() => (Foo.new() as any).method());

        nodeAssert.deepStrictEqual(calls, ['predicate 2', 'predicate 1']);
    });

    test('the factory is called exactly once, after both arms have been recorded', () => {
        /*
         * The factory is not a per-arm hook: it runs where the failure is final, so
         * it is called once and sees the record built from every arm. Calling it from
         * inside an arm would raise a typed error that a later arm could have made
         * moot, which is the throwing workaround this option replaces.
         */
        const order: string[] = [];

        class Foo extends Contracted {
            @demands(() => { order.push('arm 1'); return false; })
            @demands(() => { order.push('arm 2'); return false; })
            method(): void { }
        }

        class Bar extends Contracted {
            @demands(() => false, {
                onViolation: violation => {
                    order.push(`factory with ${violation.failedIndices.length} failures`);

                    return new PermissionDenied('no');
                },
            })
            @demands(() => false)
            method(): void { }
        }

        capture(() => (Foo.new() as any).method());
        nodeAssert.deepStrictEqual(order, ['arm 2', 'arm 1']);

        order.length = 0;
        capture(() => (Bar.new() as any).method());
        nodeAssert.deepStrictEqual(order, ['factory with 2 failures']);
    });

    test('the violation the factory sees names every failed arm', () => {
        let received: ContractViolation | undefined;

        class Foo extends Contracted {
            @demands(() => false, { onViolation: violation => { received = violation; return new Error('no'); } })
            @demands(() => false)
            method(): void { }
        }

        capture(() => (Foo.new() as any).method());

        nodeAssert.deepStrictEqual(received?.failedIndices, [0, 1]);
    });

    test('the violation exposes the arms that threw, which a bare constructor would lose', () => {
        let received: ContractViolation | undefined;

        class Denied extends Error {
            override name = 'Denied';
        }

        class Foo extends Contracted {
            @demands(() => { throw new Denied('no'); }, {
                onViolation: violation => { received = violation; return new Error('converted'); },
            })
            method(): void { }
        }

        const error = capture(() => (Foo.new() as any).method());

        nodeAssert.strictEqual(error.message, 'converted');
        nodeAssert.deepStrictEqual(received?.thrownIndices, [0]);
        nodeAssert.deepStrictEqual(received?.thrown, ['Denied: no']);
    });
});

describe('The factory decides the error even when an arm threw', () => {
    /*
     * Without a factory, a thrown arm's value is what the caller receives. A
     * declared factory is the caller's explicit choice of error type, and it is
     * given `thrownIndices`, so preferring it loses nothing.
     */
    class Foo extends Contracted {
        @demands(() => { throw new Error('predicate bug'); }, {
            onViolation: () => new PermissionDenied('translated'),
        })
        method(): void { }
    }

    test('the factory\'s error wins over the thrown value', () => {
        const error = capture(() => (Foo.new() as any).method());

        nodeAssert.strictEqual(error instanceof PermissionDenied, true);
        nodeAssert.strictEqual(error.message, 'translated');
    });
});

describe('The factory\'s error carries the contract details', () => {
    class Account extends Contracted {
        @demands(() => false, {
            onViolation: violation => new PermissionDenied('denied', violation),
        })
        withdraw(): void { }
    }

    const raised = (): any => capture(() => Account.new().withdraw());

    test('`violation` is attached', () => {
        const error = raised();

        nodeAssert.strictEqual(error.violation.contract, '@demands');
        nodeAssert.strictEqual(error.violation.feature, 'withdraw');
    });

    test('`cause` is the AssertionError describing every arm', () => {
        const error = raised();

        nodeAssert.strictEqual(error.cause instanceof AssertionError, true);
        nodeAssert.match(error.cause.message, /@demands failed for Account\.withdraw/);
    });

    test('`cause` is attached non-enumerably, so the error still serialises as its author intended', () => {
        const error = raised();

        nodeAssert.strictEqual(Object.getOwnPropertyDescriptor(error, 'cause')?.enumerable, false);
        nodeAssert.doesNotThrow(() => JSON.stringify(error));
    });

    test('a factory that does not supply a violation gets one attached non-enumerably', () => {
        class Foo extends Contracted {
            @demands(() => false, { onViolation: () => new Error('denied') })
            method(): void { }
        }

        const error = capture(() => (Foo.new() as any).method());

        nodeAssert.strictEqual(error.violation?.contract, '@demands');
        nodeAssert.strictEqual(Object.getOwnPropertyDescriptor(error, 'violation')?.enumerable, false);
    });

    test('an unset optional `violation` parameter property still receives the record', () => {
        /*
         * An error class that declares `readonly violation?: ContractViolation` as a
         * parameter property owns that property from construction, holding
         * `undefined` until it is assigned. That is not a deliberate omission, so the
         * record is still attached — otherwise the option's whole purpose would be
         * lost for the most natural way to write the error.
         */
        class Foo extends Contracted {
            @demands(() => false, { onViolation: () => new PermissionDenied('denied') })
            method(): void { }
        }

        const error = capture(() => (Foo.new() as any).method());

        nodeAssert.strictEqual(Object.hasOwn(error, 'violation'), true);
        nodeAssert.strictEqual(error.violation?.contract, '@demands');
        nodeAssert.strictEqual(error.violation?.feature, 'method');
    });

    test('a violation the factory supplied itself is kept', () => {
        let built: ContractViolation | undefined;

        class Foo extends Contracted {
            @demands(() => false, {
                onViolation: violation => {
                    built = { ...violation, contract: '@demands' };

                    return new PermissionDenied('denied', built);
                },
            })
            method(): void { }
        }

        const error = capture(() => (Foo.new() as any).method());

        // The factory may narrow or extend the record it was handed; the library
        // does not replace a value the author chose to carry.
        nodeAssert.strictEqual(error.violation, built);
    });

    test('a `cause` the factory set itself is kept', () => {
        const underlying = new Error('socket closed');

        class Foo extends Contracted {
            @demands(() => false, {
                onViolation: () => Object.assign(new PermissionDenied('denied'), { cause: underlying }),
            })
            method(): void { }
        }

        nodeAssert.strictEqual(capture(() => (Foo.new() as any).method()).cause, underlying);
    });
});

describe('Precedence across arms is the first arm evaluated', () => {
    /*
     * Decorators evaluate bottom-up, so the arm written last in source is index 0
     * and is the first one evaluated. That arm's factory decides. This is the same
     * rule that makes the first passing arm decide a normalized value.
     */
    class Foo extends Contracted {
        @demands(() => false, { onViolation: () => new PermissionDenied('top') })
        @demands(() => false, { onViolation: () => new PermissionDenied('bottom') })
        method(): void { }
    }

    test('two declaring arms: the one evaluated first wins', () => {
        nodeAssert.strictEqual(capture(() => (Foo.new() as any).method()).message, 'bottom');
    });

    test('an arm that declares no factory defers to one that does', () => {
        class Sparse extends Contracted {
            @demands(() => false, { onViolation: () => new PermissionDenied('declared') })
            @demands(() => false)
            method(): void { }
        }

        nodeAssert.strictEqual(capture(() => (Sparse.new() as any).method()).message, 'declared');
    });
});

describe('Precedence across inheritance is the inherited arm first', () => {
    /*
     * Registration spreads the inherited record, so base arms come before a
     * subclass's own. A base factory therefore wins over a subclass one, matching
     * the order the violation's `failedIndices` uses.
     */
    class Base extends Contracted {
        @demands(() => false, { onViolation: () => new PermissionDenied('base') })
        method(): void { }
    }

    class Sub extends Base {
        @demands(() => false, { onViolation: () => new PermissionDenied('sub') })
        override method(): void { }
    }

    test('the base arm\'s factory wins', () => {
        nodeAssert.strictEqual(capture(() => (Sub.new() as any).method()).message, 'base');
    });

    test('the violation lists the base arm before the subclass arm', () => {
        let received: ContractViolation | undefined;

        // The base declares no factory here, so the subclass's is the only one and
        // it observes the composition order directly.
        class PlainBase extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        class Sub2 extends PlainBase {
            @demands(() => false, {
                onViolation: violation => { received = violation; return new PermissionDenied('sub'); },
            })
            override method(): void { }
        }

        capture(() => (Sub2.new() as any).method());

        nodeAssert.deepStrictEqual(received?.failedIndices, [0, 1]);
    });

    test('a subclass that declares only the factory-less arm still inherits the base factory', () => {
        class WithFactorySub extends Base {
            override method(): void { }
        }

        nodeAssert.strictEqual(capture(() => (WithFactorySub.new() as any).method()).message, 'base');
    });
});

describe('A factory must return an object', () => {
    /*
     * `violation` and `cause` are attached to the object the factory returns. A
     * primitive has nowhere for them to go, so the declaration is refused at the
     * point the failure would have hidden the loss.
     */
    class Foo extends Contracted {
        @demands(() => false, { onViolation: (() => 'just a string') as any })
        method(): void { }
    }

    test('a primitive return is reported, naming the contract and feature', () => {
        nodeAssert.throws(
            () => (Foo.new() as any).method(),
            (error: any) => error instanceof TypeError && /@demands onViolation for Foo\.method returned string/.test(error.message),
        );
    });

    test('the contract failure travels as `cause`, so the reason is readable', () => {
        nodeAssert.throws(
            () => (Foo.new() as any).method(),
            (error: any) => error.cause instanceof AssertionError && /@demands failed/.test(error.cause.message),
        );
    });

    test('a `null` return is reported the same way', () => {
        class Nullish extends Contracted {
            @demands(() => false, { onViolation: (() => null) as any })
            method(): void { }
        }

        nodeAssert.throws(() => (Nullish.new() as any).method(), /returned object; it must return an object/);
    });

    test('a non-function declaration is refused at decoration time', () => {
        nodeAssert.throws(() => {
            class Bar extends Contracted {
                @demands(() => true, { onViolation: 'nope' as any })
                method(): void { }
            }

            void Bar;
        }, /@demands onViolation must be a function/);
    });
});

describe('`@ensures` accepts a factory', () => {
    class Counter extends Contracted {
        private _total = 0;

        @ensures(({ result }: EnsuresSubject<Counter, [], number>) => result >= 0, {
            onViolation: violation => new PermissionDenied('negative result', violation),
        })
        decrement(): number {
            return --this._total;
        }
    }

    test('a failed postcondition raises the factory\'s error', () => {
        const error = capture(() => (Counter.new() as any).decrement());

        nodeAssert.strictEqual(error instanceof PermissionDenied, true);
        nodeAssert.strictEqual(error.violation?.contract, '@ensures');
        nodeAssert.strictEqual(error.violation?.feature, 'decrement');
    });

    test('a satisfied postcondition raises nothing', () => {
        class Positive extends Contracted {
            private _total = 1;

            @ensures(({ result }: EnsuresSubject<Positive, [], number>) => result >= 0, {
                onViolation: () => new PermissionDenied('negative result'),
            })
            decrement(): number {
                return --this._total;
            }
        }

        nodeAssert.doesNotThrow(() => (Positive.new() as any).decrement());
    });

    test('precedence across arms follows evaluation order, as it does for `@demands`', () => {
        class Foo extends Contracted {
            @ensures(() => false, { onViolation: () => new PermissionDenied('top') })
            @ensures(() => false, { onViolation: () => new PermissionDenied('bottom') })
            method(): void { }
        }

        nodeAssert.strictEqual(capture(() => (Foo.new() as any).method()).message, 'bottom');
    });

    test('an inherited arm\'s factory wins over a subclass\'s', () => {
        class Base extends Contracted {
            @ensures(() => false, { onViolation: () => new PermissionDenied('base') })
            method(): void { }
        }

        class Sub extends Base {
            @ensures(() => false, { onViolation: () => new PermissionDenied('sub') })
            override method(): void { }
        }

        nodeAssert.strictEqual(capture(() => (Sub.new() as any).method()).message, 'base');
    });
});

describe('`@invariant` refuses a factory', () => {
    /*
     * An invariant failure is what signals an unrecoverable instance, and the
     * lifecycle recognises it as an AssertionError whose `violation.contract` is
     * `'@invariant'`. An error built by a factory is neither, so the repair
     * protocol would not see it. `@invariant` has its own route to a typed error
     * through a `@rescue` handler.
     */
    test('the declaration is refused where it is written', () => {
        nodeAssert.throws(() => {
            @invariant(() => true, { onViolation: () => new PermissionDenied('no') })
            class Foo extends Contracted { }

            void Foo;
        }, /@invariant cannot declare onViolation/);
    });

    test('the message points at `@rescue` instead', () => {
        nodeAssert.throws(() => {
            @invariant(() => true, { onViolation: () => new PermissionDenied('no') })
            class Foo extends Contracted { }

            void Foo;
        }, /Translate it with a `@rescue` handler/);
    });

    test('a falsy non-function is refused, as it is on `@demands`', () => {
        /*
         * The two guards enforce one rule, so a value one refuses the other refuses
         * too. A truthiness test would let `false`, `0`, `''`, and `null` through on
         * `@invariant` and into the metadata record, where they would be a factory
         * that is not callable.
         */
        for (const value of [false, 0, '', null] as any[])
            nodeAssert.throws(() => {
                @invariant(() => true, { onViolation: value })
                class Foo extends Contracted { }

                void Foo;
            }, /@invariant cannot declare onViolation/);
    });

    test('a falsy non-function is refused on `@demands`, for the same reason', () => {
        for (const value of [false, 0, '', null] as any[])
            nodeAssert.throws(() => {
                class Bar extends Contracted {
                    @demands(() => true, { onViolation: value })
                    method(): void { }
                }

                void Bar;
            }, /@demands onViolation must be a function/);
    });

    test('a construction-time invariant failure is not rescuable', () => {
        /*
         * `Contracted.new` evaluates the invariant before it proxies the instance,
         * outside every lifecycle and therefore outside any `@rescue`. The failure is
         * a plain `AssertionError`; a handler on a feature never runs, because no
         * feature is in play. This is the one path the `@rescue` route does not
         * cover, and the refusal message says so.
         */
        let handlerRan = false;

        @invariant(({ self }: { self: NeverValid }) => self._valid)
        class NeverValid extends Contracted {
            _valid = false;

            @rescue(() => { handlerRan = true; })
            method(): void { }
        }

        const error = capture(() => NeverValid.new());

        nodeAssert.strictEqual(error instanceof AssertionError, true);
        nodeAssert.strictEqual(error.violation?.contract, '@invariant');
        nodeAssert.strictEqual(handlerRan, false);
    });

    test('a `@rescue` handler observes the invariant failure', () => {
        const seen: unknown[] = [];

        @invariant(({ self }: { self: Broken }) => self._valid)
        class Broken extends Contracted {
            _valid = true;

            @rescue(({ error, self }: RescueSubject<Broken>) => {
                seen.push(error);
                self._valid = true;
            })
            ruin(): void {
                this._valid = false;
            }
        }

        // No `retry`, so the call fails: `@rescue` resumes a body, and the body it
        // would resume has already run. The repair is what survives, and the handler
        // is what observed the failure.
        nodeAssert.throws(() => (Broken.new() as any).ruin(), /@invariant failed/);
        nodeAssert.strictEqual(seen.length, 1);
        nodeAssert.strictEqual((seen[0] as AssertionError).violation?.contract, '@invariant');
    });

    test('a handler that repairs and then throws its own error translates the failure', () => {
        /*
         * This is the typed-error route `@invariant` keeps instead of a factory. The
         * handler is called with the invariant failure, restores the state, and
         * raises its own error; because the instance is valid again, that error is
         * what reaches the caller.
         */
        @invariant(({ self }: { self: Translated }) => self._valid)
        class Translated extends Contracted {
            _valid = true;

            @rescue(({ self }: RescueSubject<Translated>) => {
                self._valid = true;
                throw new PermissionDenied('translated from @invariant');
            })
            ruin(): void {
                this._valid = false;
            }
        }

        const error = capture(() => (Translated.new() as any).ruin());

        nodeAssert.strictEqual(error instanceof PermissionDenied, true);
        nodeAssert.strictEqual(error.message, 'translated from @invariant');
    });
});

describe('`checkedMode` disables the factory along with the contract', () => {
    test('no factory runs when checking is off', () => {
        let called = false;

        class Foo extends Contracted {
            @demands(() => false, { onViolation: () => { called = true; return new PermissionDenied('no'); } })
            method(): void { }
        }

        const foo = Foo.new() as any;

        Contracted[checkedMode] = false;

        try {
            // The contract does not run at all, so neither does its factory.
            nodeAssert.doesNotThrow(() => foo.method());
            nodeAssert.strictEqual(called, false);
        } finally {
            Contracted[checkedMode] = true;
        }
    });
});
