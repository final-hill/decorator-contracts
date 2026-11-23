import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant, type EnsuresSubject } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/328
 *
 * `old` describes only the instance. A driver that states a property over an object
 * it was *given* therefore cannot ask what that object was before the call: `old`
 * shares a class instance by reference, so a self-comparison passes vacuously.
 * `oldArgs` is the pre-state of the invocation's arguments, on the same terms as
 * `old` — own state copied, prototype shared, accessors copied as descriptors.
 */
describe('`oldArgs` describes the arguments from before the body ran', () => {
    test('an argument\'s pre-state is visible after the body mutates it', () => {
        let sawHeldBefore: boolean | undefined;

        class Book extends Contracted {
            public _onHold = false;

            get onHold() { return this._onHold; }

            @demands(({ self }) => !self._onHold)
            @ensures(({ self }) => self._onHold)
            placeHold(): void { this._onHold = true; }
        }

        class Usage extends Contracted {
            @ensures(({ args: [b], oldArgs: [before_] }) => {
                sawHeldBefore = before_.onHold;

                return b.onHold && !before_.onHold;
            })
            holdFor(b: Book): void { b.placeHold(); }
        }

        const book = Book.new();

        Usage.new().holdFor(book);

        nodeAssert.strictEqual(sawHeldBefore, false, 'the argument was not held before the call');
        nodeAssert.strictEqual(book.onHold, true, 'and it is held now');
    });

    test('the pre-state is what the body changed, not what it produced', () => {
        let prior: string | undefined,
            current: string | undefined;

        class Book extends Contracted {
            public _holder?: string;

            get holder() { return this._holder; }

            @ensures(() => true)
            checkout(patron: string): void { this._holder = patron; }
        }

        class Driver extends Contracted {
            @ensures(({ args: [b], oldArgs: [before_] }) => {
                prior = before_.holder;
                current = b.holder;

                return true;
            })
            run(b: Book, patron: string): void { b.checkout(patron); }
        }

        (Driver.new() as Driver).run(Book.new(), 'ada');

        nodeAssert.strictEqual(prior, undefined, 'the argument had no holder before the call');
        nodeAssert.strictEqual(current, 'ada');
    });

    test('the snapshot is a copy that keeps the argument\'s prototype', () => {
        let sameObject: boolean | undefined,
            samePrototype: boolean | undefined,
            isRealInstance: boolean | undefined;

        class Book extends Contracted {
            public _holder?: string;

            get holder() { return this._holder; }

            @ensures(() => true)
            checkout(patron: string): void { this._holder = patron; }
        }

        class Driver extends Contracted {
            @ensures(({ args: [b], oldArgs: [before_] }) => {
                sameObject = before_ === b;
                samePrototype = Object.getPrototypeOf(before_) === Object.getPrototypeOf(b);
                isRealInstance = before_ instanceof Book;

                return true;
            })
            run(b: Book, patron: string): void { b.checkout(patron); }
        }

        (Driver.new() as Driver).run(Book.new(), 'ada');

        nodeAssert.strictEqual(sameObject, false, 'the snapshot is a copy, not the live argument');
        nodeAssert.strictEqual(samePrototype, true, 'the copy keeps the argument\'s prototype');
        nodeAssert.strictEqual(isRealInstance, true, 'so it still reads as an instance of its class');
    });

    test('a mutation the body makes to a plain-data argument is not visible', () => {
        let observed: number[] | undefined;

        class Driver extends Contracted {
            @ensures(({ oldArgs: [before_] }) => {
                observed = before_;

                return true;
            })
            run(items: number[]): void { items.push(2); }
        }

        (Driver.new() as Driver).run([1]);

        nodeAssert.deepStrictEqual(observed, [1], 'a plain container is cloned, as a field would be');
    });

    test('the snapshot is taken after normalization, so it matches what the body got', () => {
        let prior: unknown;

        const doubled = {
            '~standard': {
                version: 1 as const,
                vendor: 'probe',
                validate: (value: unknown) => ({ value: [(value as number[])[0] * 2] }),
            },
        };

        class Driver extends Contracted {
            @demands(doubled, { normalize: true })
            @ensures(({ args: [given], oldArgs: [before_] }) => {
                prior = before_;

                return before_ === given;
            })
            run(_amount: number): void { }
        }

        (Driver.new() as Driver).run(3);

        nodeAssert.strictEqual(prior, 6, 'a normalizing precondition replaces the argument the body receives');
    });

    test('a getter has no `oldArgs`, because a result has no pre-state', () => {
        let observed: unknown[] | undefined;

        class Counter extends Contracted {
            public _n = 1;

            @ensures(({ oldArgs }) => {
                observed = oldArgs;

                return true;
            })
            get n() { return this._n; }
        }

        void (Counter.new() as Counter).n;

        nodeAssert.deepStrictEqual(observed, [], 'a getter is described by its result, not its arguments');
    });

    test('a setter describes the value it was given, whose pre-state is that value', () => {
        let prior: number | undefined,
            after: number | undefined;

        class Box extends Contracted {
            public _value = 0;

            @ensures(({ self, args: [assigned], oldArgs: [before_] }) => {
                prior = before_;
                after = self._value;

                return before_ === 7 && assigned === 7;
            })
            set value(v: number) { this._value = v; }
        }

        (Box.new() as Box).value = 7;

        nodeAssert.strictEqual(prior, 7, 'the assigned value is a primitive, so its pre-state is itself');
        nodeAssert.strictEqual(after, 7);
    });

    test('an own accessor is copied as a descriptor, not invoked while snapshotting', () => {
        let accessorRuns = 0,
            runsWhenPredicateStarts = -1,
            observed: boolean | undefined;

        class Book extends Contracted {
            public _onHold = false;
            public _held?: boolean;

            @ensures(() => true)
            placeHold(): void { this._onHold = true; }
        }

        class Driver extends Contracted {
            @ensures(({ oldArgs: [before_] }) => {
                runsWhenPredicateStarts = accessorRuns;
                observed = before_._held;

                return true;
            })
            run(_b: Book): void { }
        }

        const book = Book.new();

        // An own accessor on the argument. Copying the descriptor leaves it
        // unevaluated; materializing the value would run it here.
        Object.defineProperty(book, '_held', {
            get() { accessorRuns++; return this._onHold; },
            enumerable: true,
            configurable: true,
        });

        accessorRuns = 0;

        (Driver.new() as Driver).run(book);

        nodeAssert.strictEqual(runsWhenPredicateStarts, 0, 'snapshotting must not evaluate an accessor');
        nodeAssert.strictEqual(observed, false, 'and reading it on the copy yields the historical value');
        nodeAssert.strictEqual(accessorRuns, 1, 'the predicate\'s read is the only evaluation');
    });

    test('snapshotting an argument runs none of that argument\'s contracts', () => {
        let bookInvariantRuns = 0;

        @invariant(() => { bookInvariantRuns++; return true; })
        class Book extends Contracted {
            public _onHold = false;

            // A declared getter is the read that starts a lifecycle through the proxy,
            // so it is what distinguishes a snapshot from the live argument.
            get onHold() { return this._onHold; }

            @ensures(() => true)
            placeHold(): void { this._onHold = true; }
        }

        class Driver extends Contracted {
            @ensures(({ oldArgs: [before_] }) => before_.onHold === false)
            run(_b: Book): void { }
        }

        const book = Book.new();

        bookInvariantRuns = 0;   // `.new()` runs the invariant once during construction

        (Driver.new() as Driver).run(book);

        nodeAssert.strictEqual(bookInvariantRuns, 0, 'the snapshot reads below the proxy, so no lifecycle runs');
    });

    test('an argument that is already invalid can still be described', () => {
        let described: boolean | undefined;

        @invariant(({ self }) => self._n >= 0)
        class Counted extends Contracted {
            public _n = 1;

            get n() { return this._n; }
        }

        class Driver extends Contracted {
            @ensures(({ oldArgs: [before_] }) => {
                described = before_.n === -5;

                return true;
            })
            run(_c: Counted): void { }
        }

        const counted = Counted.new() as Counted;

        // Break the instance below the traps, so its next lifecycle would throw.
        Object.defineProperty(counted, '_n', { value: -5, writable: true, enumerable: true, configurable: true });

        nodeAssert.doesNotThrow(() => (Driver.new() as Driver).run(counted),
            'a snapshot that read through the proxy would raise Counted\'s entry invariant');
        nodeAssert.strictEqual(described, true);
    });

    test('a generator has no `oldArgs`, because its `args` is the yielded value', () => {
        let observedArgs: unknown[] | undefined,
            observedOldArgs: unknown[] | undefined;

        class Counter extends Contracted {
            public _n = 0;

            @ensures(({ args, oldArgs }: EnsuresSubject<Counter, [number], unknown>) => {
                observedArgs = args;
                observedOldArgs = oldArgs;

                return true;
            })
            *steps(): Generator<number> { this._n++; yield this._n; }
        }

        (Counter.new() as Counter).steps().next();

        nodeAssert.deepStrictEqual(observedArgs, [1], '`args` is the value the step yielded');
        nodeAssert.deepStrictEqual(observedOldArgs, [], 'and a yielded value has no pre-state');
    });

    test('an object passed twice is one copy in the snapshot', () => {
        let sameCopy: boolean | undefined;

        class Driver extends Contracted {
            @ensures(({ oldArgs: [a, b] }) => {
                sameCopy = a === b;

                return true;
            })
            run(_a: unknown, _b: unknown): void { }
        }

        const shared = { k: 1 };

        (Driver.new() as Driver).run(shared, shared);

        nodeAssert.strictEqual(sameCopy, true,
            'one identity map spans the argument list, so a repeated argument is not copied twice');
    });

    test('`@ensures` is not run for a getter, so its arguments are never snapshotted', () => {
        let ran = 0;

        // A getter's lifecycle is invoked with no arguments, so it has nothing to
        // snapshot; `@ensures` still runs, with `args`/`oldArgs` describing the result.
        class Counter extends Contracted {
            public _n = 1;

            @ensures(() => { ran++; return true; })
            get n() { return this._n; }
        }

        void (Counter.new() as Counter).n;

        nodeAssert.strictEqual(ran, 1, 'the postcondition runs once for the getter read');
    });

    test('an `async` feature gets the snapshot too', async () => {
        let prior: boolean | undefined,
            current: boolean | undefined;

        class Book extends Contracted {
            public _held = false;

            get held() { return this._held; }

            @ensures(() => true)
            async hold(): Promise<void> {
                await Promise.resolve();
                this._held = true;
            }
        }

        class Driver extends Contracted {
            @ensures(async ({ args: [b], oldArgs: [before_] }) => {
                prior = before_.held;
                current = b.held;

                return !before_.held && b.held;
            }, { awaitPredicate: true })
            async run(b: Book): Promise<void> { await b.hold(); }
        }

        await (Driver.new() as Driver).run(Book.new());

        nodeAssert.strictEqual(prior, false);
        nodeAssert.strictEqual(current, true);
    });
});

describe('`oldArgs` is a snapshot, not a relaxation of enforcement', () => {
    test('the callee\'s own contracts still run when a driver calls it', () => {
        class Book extends Contracted {
            public _holder?: string;

            get holder() { return this._holder; }

            @demands(({ args: [p] }) => p.length > 2)
            @ensures(({ self, args: [p] }) => self.holder === p)
            checkout(patron: string): void { this._holder = patron; }
        }

        class Driver extends Contracted {
            @ensures(({ args: [b] }) => b.holder !== undefined)
            run(b: Book, patron: string): void { b.checkout(patron); }
        }

        const driver = Driver.new() as Driver;

        nodeAssert.throws(() => driver.run(Book.new(), 'ab'), /@demands failed for Book\.checkout/);
    });

    test('a driver still enforces its own precondition over the argument', () => {
        class Book extends Contracted {
            public _onHold = false;

            get onHold() { return this._onHold; }

            @ensures(() => true)
            placeHold(): void { this._onHold = true; }
        }

        class Usage extends Contracted {
            @demands(({ args: [b] }) => !b.onHold)
            @ensures(({ args: [b] }) => b.onHold)
            holdFor(b: Book): void { b.placeHold(); }
        }

        const usage = Usage.new() as Usage,
            held = Book.new();

        held.placeHold();

        nodeAssert.throws(() => usage.holdFor(held), /@demands failed for Usage\.holdFor/);
    });
});

describe('An argument that cannot be snapshotted is reported where it happens', () => {
    test('the error names the feature and the argument position', () => {
        class Driver extends Contracted {
            @ensures(() => true)
            run(_a: number, _b: unknown): void { }
        }

        const driver = Driver.new() as Driver,
            boom = new Proxy({}, {
                getPrototypeOf() { throw new Error('snapshot boom'); },
            });

        nodeAssert.throws(
            () => driver.run(1, boom),
            (error: any) => {
                nodeAssert.strictEqual(error.constructor, TypeError);
                nodeAssert.match(error.message, /@ensures on 'run' cannot snapshot argument 1/);
                nodeAssert.strictEqual((error.cause as Error).message, 'snapshot boom');

                return true;
            },
        );
    });

    test('a feature with no postcondition never snapshots its arguments', () => {
        class Plain extends Contracted {
            @demands(() => true)
            run(_n: unknown): void { }
        }

        nodeAssert.doesNotThrow(() => (Plain.new() as Plain).run(1), 'a readable argument is fine');

        // A throwing `getPrototypeOf` cannot be inspected, so a feature that
        // snapshotted unconditionally would fail here. `@demands` alone does not
        // read the prototype, so this must pass.
        const boom = new Proxy({}, {
            getPrototypeOf() { throw new Error('snapshot boom'); },
        });

        nodeAssert.doesNotThrow(() => (Plain.new() as any).run(boom));
    });
});
