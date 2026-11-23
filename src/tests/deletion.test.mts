import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { checkedMode, Contracted, demands, encapsulationMode, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/287
 *
 * Deletion is an external mutation, so it follows the same rule as assignment:
 * only `_`-prefixed properties — the ones a caller may mutate — can be removed,
 * and the `checkedMode` switch applies.
 */
describe('Deletion follows the same rule as assignment', () => {
    const cases: Array<{ label: string, name: string }> = [
        { label: 'an `_`-prefixed property', name: '_private' },
        { label: 'a public property', name: 'publicProp' },
        { label: 'an absent property', name: 'nonexistent' },
    ];

    for (const { label, name } of cases) {
        test(`set and delete agree for ${label}`, () => {
            class Foo extends Contracted {
                _private = 1;
                publicProp = 2;
            }

            const setOutcome = (() => {
                try { (Foo.new() as any)[name] = 3; return 'allowed'; }
                catch { return 'blocked'; }
            })();

            const deleteOutcome = (() => {
                try { delete (Foo.new() as any)[name]; return 'allowed'; }
                catch { return 'blocked'; }
            })();

            nodeAssert.strictEqual(deleteOutcome, setOutcome);
        });
    }

    test('an `_`-prefixed property is actually removed', () => {
        class Foo extends Contracted {
            _private = 1;
        }

        const foo = Foo.new() as any;

        nodeAssert.strictEqual(delete foo._private, true);
        nodeAssert.strictEqual('_private' in foo, false);
    });

    test('a public property is not removed', () => {
        class Foo extends Contracted {
            publicProp = 2;
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => { delete foo.publicProp; }, TypeError);
        nodeAssert.strictEqual(foo.publicProp, 2);
    });
});

describe('Deletion respects encapsulation mode', () => {
    test('deletion is unrestricted when encapsulation mode is disabled', () => {
        class Foo extends Contracted {
            _private = 1;
            publicProp = 2;

            static [encapsulationMode] = false;
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(() => { delete foo.publicProp; });
        nodeAssert.doesNotThrow(() => { delete foo._private; });
        nodeAssert.strictEqual('publicProp' in foo, false);
        nodeAssert.strictEqual('_private' in foo, false);
    });

    test('disabling `checkedMode` alone leaves deletion restricted', () => {
        class Foo extends Contracted {
            publicProp = 2;

            static [checkedMode] = false;
        }

        nodeAssert.throws(() => { delete (Foo.new() as any).publicProp; }, TypeError);
    });

    test('deletion is restricted again once encapsulation mode is re-enabled', () => {
        class Foo extends Contracted {
            publicProp = 2;
        }

        const foo = Foo.new() as any;

        Foo[encapsulationMode] = false;
        try { delete foo.publicProp; } finally { Foo[encapsulationMode] = true; }

        nodeAssert.throws(() => { delete foo.publicProp; }, TypeError);
    });
});

describe('Deletion runs the contract lifecycle', () => {
    test('the invariant is evaluated on delete', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Foo extends Contracted {
            _temp = 1;
        }

        const foo = Foo.new() as any;
        evaluations = 0;
        delete foo._temp;

        nodeAssert.strictEqual(evaluations, 2);
    });

    test('a delete that invalidates the object is rejected', () => {
        @invariant(({ self }) => '_needed' in self)
        class Foo extends Contracted {
            _needed = 1;
        }

        const foo = Foo.new() as any;

        nodeAssert.throws(() => { delete foo._needed; }, /@invariant failed/);
    });

    test('a delete that satisfies the invariant succeeds', () => {
        @invariant(({ self }) => !('_temp' in self) || self._temp === 1)
        class Foo extends Contracted {
            _temp = 1;
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(() => { delete foo._temp; });
        nodeAssert.strictEqual('_temp' in foo, false);
    });
});

describe('A feature body may delete its own state', () => {
    test('a body deleting its own `_` field is allowed', () => {
        class Foo extends Contracted {
            _temp = 1;

            @demands(() => true)
            clear(): void { delete (this as any)._temp; }
        }

        const foo = Foo.new() as any;
        nodeAssert.doesNotThrow(() => foo.clear());

        nodeAssert.strictEqual('_temp' in foo, false);
    });
});
