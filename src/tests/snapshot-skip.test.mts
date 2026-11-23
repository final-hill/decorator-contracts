import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, ensures, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/366
 *
 * The pre-state snapshot is the most expensive work a call performs, and it is
 * paid on every call whether or not any arm reads it. Two of those cases can be
 * closed without guessing about what a predicate reads:
 *
 * - A **schema** arm is handed the value it validates, never the predicate subject,
 *   so a composition made only of schemas cannot observe `old` or `oldArgs`.
 * - The snapshot is **captured** before the body and **built** afterwards, so the
 *   build's `Reflect.defineProperty` cost can be reduced without moving when the
 *   state is observed.
 */
describe('A composition of schemas alone cannot observe the pre-state', () => {
    /** Counts the own-key enumerations a snapshot performs. */
    const countingSnapshots = (body: () => void): number => {
        const ownKeys = Reflect.ownKeys;
        let captures = 0;

        Reflect.ownKeys = function (target: object) {
            captures++;

            return ownKeys(target);
        };

        try {
            body();
        } finally {
            Reflect.ownKeys = ownKeys;
        }

        return captures;
    };

    const schema: any = {
        '~standard': { version: 1, vendor: 'test', validate: () => ({ value: true }) },
    };

    test('a schema-only @ensures takes no snapshot', () => {
        class Foo extends Contracted {
            _v = 0;

            @ensures(schema)
            bump(): number { return ++(this as any)._v; }
        }

        const foo = Foo.new() as any;

        // Warm the wrapper cache, so the count is of snapshot work only.
        foo.bump();

        nodeAssert.strictEqual(countingSnapshots(() => foo.bump()), 0);
    });

    test('one predicate arm restores the snapshot', () => {
        class Foo extends Contracted {
            _v = 0;

            @ensures(({ self }) => self._v > 0)
            bump(): number { return ++(this as any)._v; }
        }

        const foo = Foo.new() as any;

        foo.bump();

        nodeAssert.ok(countingSnapshots(() => foo.bump()) > 0, 'a predicate can read the subject');
    });

    test('a schema mixed with a predicate still snapshots', () => {
        class Foo extends Contracted {
            _v = 0;

            @ensures(schema)
            @ensures(({ self, old }) => self._v > old._v)
            bump(): number { return ++(this as any)._v; }
        }

        const foo = Foo.new() as any;

        foo.bump();

        nodeAssert.ok(countingSnapshots(() => foo.bump()) > 0, 'the predicate arm needs `old`');
    });

    test('a schema-only composition is still evaluated', () => {
        let validated = 0;

        const counting: any = {
            '~standard': {
                version: 1,
                vendor: 'test',
                validate: (value: unknown) => { validated++; return value === 1 ? { value: 1 } : { issues: [{ message: 'not 1' }] }; },
            },
        };

        class Foo extends Contracted {
            @ensures(counting)
            one(): number { return 1; }
        }

        nodeAssert.strictEqual((Foo.new() as any).one(), 1);
        nodeAssert.strictEqual(validated, 1);
    });

    test('a schema-only composition still fails', () => {
        const refuses: any = {
            '~standard': {
                version: 1,
                vendor: 'test',
                validate: () => ({ issues: [{ message: 'refused' }] }),
            },
        };

        class Foo extends Contracted {
            @ensures(refuses)
            one(): number { return 1; }
        }

        nodeAssert.throws(() => (Foo.new() as any).one(), /@ensures failed/);
    });

    test('a schema-only @ensures does not fail on an unreadable argument', () => {
        const accepts: any = {
            '~standard': { version: 1, vendor: 'test', validate: (value: unknown) => ({ value }) },
        };

        class Foo extends Contracted {
            @ensures(accepts)
            run(_n: unknown): void { }
        }

        // `oldArgs` would need each argument to be readable; the schema does not
        // read it, and the copy is skipped, so an opaque argument is no obstacle.
        const opaque = new Proxy({}, {
            getPrototypeOf() { throw new Error('not inspectable'); },
        });

        nodeAssert.doesNotThrow(() => (Foo.new() as any).run(opaque));
    });
});

/**
 * The snapshot is captured before the body and built from the capture. The split
 * must not move when the state is observed, which is the only thing that makes the
 * laziness safe.
 */
describe('The snapshot describes the state before the body ran', () => {
    test('a value cloned at capture is not the live value', () => {
        let observed: number | undefined;

        class Foo extends Contracted {
            _v = 1;

            @ensures(({ old }: any) => { observed = old._v; return true; })
            bump(): void {
                // A body runs on the raw target, so this write is invisible to any
                // snapshot taken afterwards.
                (this as any)._v = 99;
            }
        }

        (Foo.new() as any).bump();

        nodeAssert.strictEqual(observed, 1);
    });

    test('an array cloned at capture is not the live array', () => {
        let observed: number[] | undefined;

        class Foo extends Contracted {
            _rows: number[] = [1, 2];

            @ensures(({ old }: any) => { observed = old._rows; return true; })
            push(): void { (this as any)._rows.push(3); }
        }

        (Foo.new() as any).push();

        nodeAssert.deepStrictEqual(observed, [1, 2]);
        nodeAssert.notStrictEqual(observed, (Foo.new() as any)._rows);
    });

    test('property attributes survive the copy', () => {
        let saw: PropertyDescriptor | undefined;

        class Foo extends Contracted {
            _ro = 1;

            @ensures(({ old }: any) => { saw = Object.getOwnPropertyDescriptor(old, '_ro'); return true; })
            touch(): void { }
        }

        const foo = Foo.new() as any;

        Object.defineProperty(foo, '_ro', { value: 1, writable: false, enumerable: false, configurable: false });

        foo.touch();

        nodeAssert.strictEqual(saw!.writable, false, 'a read-only field stays read-only in the snapshot');
        nodeAssert.strictEqual(saw!.enumerable, false);
        nodeAssert.strictEqual(saw!.configurable, false);
    });

    test('a symbol-keyed field is snapshotted', () => {
        const key = Symbol('field');

        let observed: unknown;

        class Foo extends Contracted {
            _v = 0;

            constructor() {
                super();

                Object.defineProperty(this, key, {
                    value: 'before', writable: true, enumerable: true, configurable: true,
                });
            }

            @ensures(({ old }: any) => { observed = old[key]; return true; })
            change(): void { (this as any)[key] = 'after'; }
        }

        (Foo.new() as any).change();

        nodeAssert.strictEqual(observed, 'before');
    });

    test('a retry captures its own pre-state', () => {
        const seen: number[] = [];

        @invariant(() => true)
        class Foo extends Contracted {
            _attempt = 0;

            @ensures(({ old }: any) => { seen.push(old._attempt); return true; })
            run(): void { (this as any)._attempt++; }
        }

        const foo = Foo.new() as any;

        foo.run();

        nodeAssert.deepStrictEqual(seen, [0], 'the snapshot precedes the body it describes');
    });
});
