import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import {
    checkedMode, Contracted, demands, encapsulationMode, ensures, getContractMetadata, getFeatureContracts,
    invariant, rescue,
} from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/344
 *
 * A class-level `@rescue` applies to every feature that declares none of its
 * own, so one declaration serves a whole class instead of one per verb.
 *
 * Precedence is fixed by these tests: a feature's own declaration wins over any
 * class-level one, and the nearest class-level declaration wins over an
 * ancestor's. The rules are separate — inheriting a feature declaration from a
 * base class is not the same question as inheriting the class-level form.
 */
describe('`@rescue` is accepted on a class', () => {
    test('a class-level handler rescues a method that throws', () => {
        const seen: string[] = [];

        @rescue(({ feature, error }) => {
            seen.push(`${String(feature)}:${(error as Error).message}`);
        })
        class Foo extends Contracted {
            alpha(): void { throw new Error('a'); }
            beta(): void { throw new Error('b'); }
        }

        const foo = Foo.new();

        nodeAssert.throws(() => foo.alpha(), { message: 'a' });
        nodeAssert.throws(() => foo.beta(), { message: 'b' });
        nodeAssert.deepStrictEqual(seen, ['alpha:a', 'beta:b']);
    });

    test('the declaration is reported as the class-level entry', () => {
        const handler = (): void => { };

        @rescue(handler)
        class Foo extends Contracted {
            m(): void { }
        }

        const metadata = getContractMetadata(Foo);

        nodeAssert.deepStrictEqual(metadata.rescue, {}, 'nothing is keyed per feature');
        nodeAssert.strictEqual(metadata.classRescue?.handler, handler);
    });

    test('a class-level declaration is refused on a class that does not extend `Contracted`', () => {
        nodeAssert.throws(() => {
            @rescue(() => { })
            class Plain { }
            void Plain;
        }, /@rescue decorator can only be applied to classes that extend Contracted/);
    });

    test('a negative `maxRetries` is refused on a class', () => {
        nodeAssert.throws(() => {
            @rescue(() => { }, { maxRetries: -1 })
            class Foo extends Contracted { }
            void Foo;
        }, /maxRetries must not be negative/);
    });

    test('a misplaced declaration reports the placement, not the option', () => {
        // The placement is what makes the option meaningless, so it is the error the
        // author needs to read. Reversing the two guards would report the option
        // against a member `@rescue` could never have accepted.
        nodeAssert.throws(() => {
            class Foo extends Contracted {
                @rescue(() => { }, { maxRetries: -1 })
                static bad(): void { }
            }
            void Foo;
        }, /@rescue decorator cannot be applied to static features/);
    });
});

describe('A class-level handler serves every kind of feature', () => {
    test('a method, a getter, and a setter all reach it', () => {
        const seen: PropertyKey[] = [];

        @rescue(({ feature }) => { seen.push(feature); })
        class Foo extends Contracted {
            public _n = 1;

            method(): void { throw new Error('method'); }

            get value(): number { throw new Error('getter'); }
            set value(_v: number) { throw new Error('setter'); }
        }

        const foo = Foo.new();

        nodeAssert.throws(() => foo.method());
        nodeAssert.throws(() => foo.value);
        nodeAssert.throws(() => { foo.value = 2; });

        nodeAssert.deepStrictEqual(seen, ['method', 'value', 'value']);
    });

    test('the `delete` path reaches it, keyed on the deleted property', () => {
        const seen: PropertyKey[] = [];

        @invariant(({ self }) => (self as any).keep === 1)
        @rescue(({ feature }) => { seen.push(feature); })
        class Guarded extends Contracted {
            static [encapsulationMode] = false;

            public keep = 1;
            public temp = 0;
        }

        const guarded = Guarded.new() as any;

        // Encapsulation is off so the deletion of a public name is permitted, which
        // is the only way to reach the lifecycle for one. Removing the property the
        // invariant reads is what makes the deletion fail and consult the handler.
        nodeAssert.doesNotThrow(() => { delete guarded.temp; });
        nodeAssert.throws(() => { delete guarded.keep; }, /@invariant failed/);
        nodeAssert.deepStrictEqual(seen, ['keep']);
    });

    test('`feature` names the property the lifecycle was running for', () => {
        let feature: PropertyKey | undefined;

        @rescue((subject) => { feature = subject.feature; })
        class Foo extends Contracted {
            public _n = 1;
            get value(): number { throw new Error('read'); }
        }

        nodeAssert.throws(() => void (Foo.new() as any).value);

        nodeAssert.strictEqual(feature, 'value');
    });

    test('a feature-level handler still receives its own name', () => {
        let feature: PropertyKey | undefined;

        class Foo extends Contracted {
            @rescue((subject) => { feature = subject.feature; })
            method(): void { throw new Error('boom'); }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).method());

        nodeAssert.strictEqual(feature, 'method');
    });

    test('a `_`-prefixed feature is covered by neither form', () => {
        let ran = false;

        @rescue(() => { ran = true; })
        class Foo extends Contracted {
            public _n = 0;

            _internal(): void { throw new Error('boom'); }
        }

        // The decorator refuses a feature-level declaration on the same name, so the
        // class-level form leaves it out too: a feature a consumer cannot override is
        // a feature they could not exempt from the class handler.
        nodeAssert.throws(() => (Foo.new() as any)._internal(), { message: 'boom' });
        nodeAssert.strictEqual(ran, false);
        nodeAssert.throws(() => {
            class Bar extends Contracted {
                @rescue(() => { })
                _internal(): void { }
            }
            void Bar;
        }, /@rescue decorator cannot be applied to private\/protected features/);
    });

    test('an `async` feature rejects into the handler', async () => {
        const seen: PropertyKey[] = [];

        @rescue(({ feature }) => { seen.push(feature); })
        class Foo extends Contracted {
            async run(): Promise<number> { throw new Error('async boom'); }
        }

        await nodeAssert.rejects(() => (Foo.new() as Foo).run(), { message: 'async boom' });
        nodeAssert.deepStrictEqual(seen, ['run']);
    });

    test('a generator step fails into the handler', () => {
        const seen: PropertyKey[] = [];

        @rescue(({ feature }) => { seen.push(feature); })
        class Foo extends Contracted {
            *steps(): Generator<number> {
                yield 1;
                throw new Error('generator boom');
            }
        }

        const iterator = (Foo.new() as Foo).steps() as any;

        nodeAssert.strictEqual(iterator.next().value, 1);
        nodeAssert.throws(() => iterator.next(), { message: 'generator boom' });
        nodeAssert.deepStrictEqual(seen, ['steps']);
    });
});

describe('A class-level handler covers the same failures a feature-level one does', () => {
    test('it observes an invariant failure and can repair the instance', () => {
        @invariant(({ self }) => self._balance >= 0)
        @rescue(({ self }) => { self._balance = 0; })
        class Account extends Contracted {
            public _balance = 1;

            withdraw(amount: number): void { this._balance -= amount; }
        }

        const account = Account.new();

        nodeAssert.throws(() => account.withdraw(5), /@invariant failed/);
        nodeAssert.strictEqual(account._balance, 0, 'the handler repaired the instance');
    });

    test('it does not observe a failed `@demands`', () => {
        let ran = false;

        @rescue(() => { ran = true; })
        class Foo extends Contracted {
            @demands(({ args: [n] }) => n > 0)
            method(_n: number): void { }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).method(0), /@demands failed/);
        nodeAssert.strictEqual(ran, false, 'a rejected precondition has no body to resume');
    });

    test('it observes a failed `@ensures`', () => {
        let ran = false;

        @rescue(() => { ran = true; })
        class Foo extends Contracted {
            @ensures(({ result }) => (result as number) > 0)
            method(): number { return -1; }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).method(), /@ensures failed/);
        nodeAssert.strictEqual(ran, true);
    });
});

describe('Precedence between the two forms', () => {
    test('a feature-level declaration wins over the class-level one', () => {
        const calls: string[] = [];

        @rescue(() => { calls.push('class'); })
        class Foo extends Contracted {
            @rescue(() => { calls.push('feature'); })
            declared(): void { throw new Error('boom'); }

            undeclared(): void { throw new Error('boom'); }
        }

        const foo = Foo.new();

        nodeAssert.throws(() => foo.declared());
        nodeAssert.throws(() => foo.undeclared());
        nodeAssert.deepStrictEqual(calls, ['feature', 'class']);
    });

    test('an inherited feature-level declaration wins over a subclass class-level one', () => {
        const calls: string[] = [];

        class Base extends Contracted {
            @rescue(() => { calls.push('base-feature'); })
            override(): void { throw new Error('boom'); }
        }

        @rescue(() => { calls.push('sub-class'); })
        class Sub extends Base { }

        nodeAssert.throws(() => (Sub.new() as Sub).override());

        // The feature declaration on the base is inherited by the feature, and a
        // feature declaration outranks any class-level declaration, including one
        // on the subclass.
        nodeAssert.deepStrictEqual(calls, ['base-feature']);
    });

    test('a class-level declaration is inherited by a subclass feature', () => {
        const calls: string[] = [];

        @rescue(() => { calls.push('base-class'); })
        class Base extends Contracted {
            alpha(): void { throw new Error('boom'); }
        }

        class Sub extends Base {
            beta(): void { throw new Error('boom'); }
        }

        const sub = Sub.new();

        nodeAssert.throws(() => sub.beta());
        nodeAssert.deepStrictEqual(calls, ['base-class']);
    });

    test('a subclass class-level declaration wins over an ancestor class-level one', () => {
        const calls: string[] = [];

        @rescue(() => { calls.push('base-class'); })
        class Base extends Contracted { }

        @rescue(() => { calls.push('sub-class'); })
        class Sub extends Base {
            method(): void { throw new Error('boom'); }
        }

        nodeAssert.throws(() => (Sub.new() as Sub).method());
        nodeAssert.deepStrictEqual(calls, ['sub-class']);
    });

    test('a subclass class-level declaration does not replace the ancestor\'s', () => {
        const baseHandler = (): void => { };

        @rescue(baseHandler)
        class Base extends Contracted {
            method(): void { throw new Error('boom'); }
        }

        @rescue(() => { })
        class Sub extends Base { }

        // Each class reports its own declaration; the subclass's is not written
        // onto the ancestor it inherits from.
        nodeAssert.strictEqual(getContractMetadata(Base).classRescue?.handler, baseHandler);
        nodeAssert.notStrictEqual(getContractMetadata(Sub).classRescue?.handler, baseHandler);
    });
});

describe('`retry` from a class-level handler restarts that feature', () => {
    test('`maxRetries` is counted per feature invocation', () => {
        let runs = 0;

        @rescue(({ retry }) => {
            // Guarded so a lost bound fails the assertion instead of looping: a
            // hang is not a verdict.
            if (++runs > 10) throw new Error('the bound was not applied');

            retry();
        }, { maxRetries: 2 })
        class Foo extends Contracted {
            /** A body that never stops failing, so only the bound ends the call. */
            method(): number { throw new Error('not yet'); }
            other(): number { throw new Error('not yet'); }
        }

        const foo = Foo.new() as Foo,
            call = () => nodeAssert.throws(() => foo.method(), { message: 'not yet' });

        call();
        nodeAssert.strictEqual(runs, 2, 'the first call spends its own budget');

        // A second call gets a fresh budget. A shared one would spend nothing here,
        // which is the difference this assertion exists to read.
        call();
        nodeAssert.strictEqual(runs, 4, 'a second call gets its own budget');

        // And the budget belongs to the invocation rather than to the class, so a
        // different feature is not charged for the retries above.
        nodeAssert.throws(() => foo.other(), { message: 'not yet' });
        nodeAssert.strictEqual(runs, 6, 'another feature gets its own budget');
    });

    test('a retried method reaches `@demands` again', () => {
        const seen: number[] = [];

        @rescue(({ args, retry }) => retry(...args))
        class Foo extends Contracted {
            protected _count = 0;

            @demands(({ args: [n] }) => { seen.push(n); return n > 0; })
            run(n: number): number {
                if (this._count++ === 0) throw new Error('first');

                return n;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).run(3), 3);
        nodeAssert.deepStrictEqual(seen, [3, 3], 'the retried invocation is subject to `@demands`');
    });

    test('a getter that is retried re-runs the read', () => {
        let reads = 0;

        @rescue(({ retry }) => retry())
        class Foo extends Contracted {
            protected _count = 0;

            get value(): number {
                reads++;

                if (this._count++ === 0) throw new Error('first read');

                return 7;
            }
        }

        nodeAssert.strictEqual((Foo.new() as any).value, 7);
        nodeAssert.strictEqual(reads, 2);
    });
});

describe('The class-level declaration is reported by the metadata accessors', () => {
    test('`getFeatureContracts` reports the class-level handler for a feature that declares none', () => {
        const handler = (): void => { };

        @rescue(handler)
        class Foo extends Contracted {
            method(): void { }
        }

        nodeAssert.strictEqual(getFeatureContracts(Foo, 'method').rescue?.handler, handler);
    });

    test('`getFeatureContracts` prefers the feature-level handler', () => {
        const featureHandler = (): void => { };
        const classHandler = (): void => { };

        @rescue(classHandler)
        class Foo extends Contracted {
            @rescue(featureHandler)
            method(): void { }
        }

        nodeAssert.strictEqual(getFeatureContracts(Foo, 'method').rescue?.handler, featureHandler);
        nodeAssert.strictEqual(getContractMetadata(Foo).classRescue?.handler, classHandler);
    });

    test('a feature with neither declaration reports `undefined`', () => {
        class Foo extends Contracted {
            method(): void { }
        }

        nodeAssert.strictEqual(getFeatureContracts(Foo, 'method').rescue, undefined);
        nodeAssert.strictEqual(getContractMetadata(Foo).classRescue, undefined);
    });

    test('the class-level declaration cannot be mutated through the accessor', () => {
        @rescue(() => { })
        class Foo extends Contracted { }

        const metadata = getContractMetadata(Foo),
            live = (Foo as any)[Symbol.metadata].classRescue;

        nodeAssert.throws(() => { metadata.classRescue!.maxRetries = 0; });
        nodeAssert.notStrictEqual(metadata.classRescue, live, 'a copy, not the live declaration');
        nodeAssert.strictEqual(metadata.classRescue!.handler, live.handler, 'the handler keeps its identity');
    });
});

describe('A class-level handler respects checked mode', () => {
    test('with the contracts off the handler does not run', () => {
        let ran = false;

        @rescue(() => { ran = true; })
        class Foo extends Contracted {
            static [checkedMode] = false;

            method(): void { throw new Error('boom'); }
        }

        nodeAssert.throws(() => (Foo.new() as Foo).method(), { message: 'boom' });
        nodeAssert.strictEqual(ran, false);
    });
});
