import {
    checkedMode, Contracted, demands, encapsulationMode, ensures, invariant, rescue,
} from '@final-hill/decorator-contracts';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

/**
 * https://github.com/final-hill/decorator-contracts/issues/336
 *
 * Enforcement is resolved per class rather than process-wide, and the two
 * concerns it names — the contracts and encapsulation — are separate switches. A
 * class opts out by declaring a static, and the nearest declaration on the class
 * chain wins.
 */

describe('A subclass can opt out of the contracts without affecting its siblings', () => {
    class Base extends Contracted {
        @demands(() => false)
        @ensures(() => false)
        method(): void { }
    }

    class OptedOut extends Base {
        static [checkedMode] = false;
    }

    class Sibling extends Base { }

    test('the opted-out subclass skips its contracts', () => {
        nodeAssert.doesNotThrow(() => (OptedOut.new() as any).method());
    });

    test('a sibling still enforces them', () => {
        nodeAssert.throws(() => (Sibling.new() as any).method(), /@demands failed/);
    });

    test('the base class still enforces them', () => {
        nodeAssert.throws(() => (Base.new() as any).method(), /@demands failed/);
    });

    test('an opt-out declared on a subclass is inherited by its own subclasses', () => {
        class Grandchild extends OptedOut { }

        nodeAssert.doesNotThrow(() => (Grandchild.new() as any).method());
    });

    test('a subclass can re-enable what an ancestor disabled', () => {
        class Reenabled extends OptedOut {
            static [checkedMode] = true;
        }

        nodeAssert.throws(() => (Reenabled.new() as any).method(), /@demands failed/);
    });
});

describe('Every contract respects the class switch', () => {
    test('`@invariant` is skipped', () => {
        @invariant(() => false)
        class Foo extends Contracted {
            static [checkedMode] = false;
        }

        nodeAssert.doesNotThrow(() => Foo.new());
    });

    test('`@invariant` is skipped for an instance built before the switch changed', () => {
        // Resolution reads the class chain on every trap, so it is not captured at
        // construction time.
        @invariant(({ self }: any) => self._n > 0)
        class Foo extends Contracted {
            _n = 1;
        }

        const foo = Foo.new();

        // Break the state below the proxy, so the next accessor's entry check is
        // the first thing that would notice.
        Object.defineProperty(foo, '_n', { value: -1, writable: true, configurable: true, enumerable: true });
        Foo[checkedMode] = false;

        try {
            nodeAssert.doesNotThrow(() => { void (foo as any)._n; });
        } finally {
            Foo[checkedMode] = true;
        }

        nodeAssert.throws(() => { (foo as any)._n = -1; }, /@invariant failed/);
    });

    test('`@demands` is skipped', () => {
        class Foo extends Contracted {
            static [checkedMode] = false;

            @demands(() => false)
            method(): void { }
        }

        nodeAssert.doesNotThrow(() => (Foo.new() as any).method());
    });

    test('`@ensures` is skipped', () => {
        class Foo extends Contracted {
            static [checkedMode] = false;

            @ensures(() => false)
            method(): void { }
        }

        nodeAssert.doesNotThrow(() => (Foo.new() as any).method());
    });

    test('`@rescue` does not run', () => {
        let ran = false;

        class Foo extends Contracted {
            static [checkedMode] = false;

            @rescue(() => { ran = true; })
            method(): void { throw new Error('body boom'); }
        }

        // The body's own error reaches the caller, untouched by a handler.
        nodeAssert.throws(() => (Foo.new() as any).method(), /body boom/);
        nodeAssert.strictEqual(ran, false);
    });

    test('a getter is returned unwrapped, so no lifecycle runs for a read', () => {
        /*
         * The thenable guard is a feature-kind rule rather than a contract, so it
         * sits outside the contracts switch in the lifecycle. Reading through a
         * wrapper would therefore fail a getter that returns a promise even with
         * the contracts off; returning the getter itself means the read is just a
         * read.
         */
        class Foo extends Contracted {
            static [checkedMode] = false;

            get pending(): Promise<number> {
                return Promise.resolve(1);
            }
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(() => { void foo.pending; });

        Foo[checkedMode] = true;

        // With the contracts on, the same read is checked and refused.
        nodeAssert.throws(() => { void foo.pending; }, /returned a promise/);
    });

    test('a schema arm is not consulted', () => {
        let consulted = false;

        const schema: any = {
            '~standard': {
                version: 1,
                vendor: 'test',
                validate: () => { consulted = true; return { value: undefined }; },
            },
        };

        class Foo extends Contracted {
            static [checkedMode] = false;

            @demands(schema)
            method(): void { }
        }

        nodeAssert.doesNotThrow(() => (Foo.new() as any).method());
        nodeAssert.strictEqual(consulted, false);
    });
});

describe('Contracts and encapsulation toggle independently', () => {
    test('contracts off, encapsulation on: a public write is still refused', () => {
        class Foo extends Contracted {
            publicProp = 1;

            static [checkedMode] = false;

            @ensures(() => false)
            method(): void { }
        }

        const foo = Foo.new() as any;

        // No postcondition to trip.
        nodeAssert.doesNotThrow(() => foo.method());

        // The write protection is still in force.
        nodeAssert.throws(() => { foo.publicProp = 2; }, TypeError);
    });

    test('encapsulation off, contracts on: the write is permitted and the contracts still run', () => {
        class Foo extends Contracted {
            publicProp = 1;

            static [encapsulationMode] = false;

            @ensures(() => false)
            method(): void { }
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(() => { foo.publicProp = 2; });
        nodeAssert.strictEqual(foo.publicProp, 2);

        nodeAssert.throws(() => foo.method(), /@ensures failed/);
    });

    test('a write still runs the lifecycle when encapsulation is off', () => {
        /*
         * `_`-prefixed writes are permitted either way, so this isolates the one
         * variable. The switch removes the name verdict, not the feature invocation:
         * a permitted write is still an external mutation, and a setter's
         * postcondition describes it.
         */
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Restricted extends Contracted {
            _v = 0;
        }

        @invariant(() => { evaluations++; return true; })
        class Open extends Contracted {
            _v = 0;

            static [encapsulationMode] = false;
        }

        const restricted = Restricted.new() as any,
            open = Open.new() as any;

        const base = evaluations;

        restricted._v = 1;
        const restrictedCost = evaluations - base;
        const openBase = evaluations;

        open._v = 2;
        const openCost = evaluations - openBase;

        nodeAssert.ok(restrictedCost > 0, 'the entry and exit invariant run for a permitted write');
        nodeAssert.strictEqual(openCost, restrictedCost, 'the switch does not change how many times it runs');
    });

    test('a setter\'s postcondition runs when encapsulation is off', () => {
        let runs = 0;

        class Foo extends Contracted {
            _v = 0;

            static [encapsulationMode] = false;

            @ensures(() => { runs++; return false; })
            set value(v: number) { this._v = v; }
        }

        const foo = Foo.new() as any;

        // The postcondition both ran and failed, which is what reaches the caller.
        nodeAssert.throws(() => { foo.value = 1; }, /@ensures failed/);
        nodeAssert.strictEqual(runs, 1);
    });

    test('a deletion still runs the lifecycle when encapsulation is off', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Open extends Contracted {
            _v = 1;

            static [encapsulationMode] = false;
        }

        const open = Open.new() as any,
            base = evaluations;

        delete open._v;

        nodeAssert.strictEqual('_v' in open, false);
        nodeAssert.ok(evaluations - base > 0, 'a permitted deletion is still an external mutation');
    });

    test('both off: no check and no write protection', () => {
        class Foo extends Contracted {
            publicProp = 1;

            static [checkedMode] = false;
            static [encapsulationMode] = false;

            @ensures(() => false)
            method(): void { }
        }

        const foo = Foo.new() as any;

        nodeAssert.doesNotThrow(() => foo.method());
        nodeAssert.doesNotThrow(() => { foo.publicProp = 2; });
    });

    test('the two switches resolve independently on one class chain', () => {
        class Base extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        // Contracts come from the base's opt-out; encapsulation is declared here.
        class ContractsOff extends Base {
            static [checkedMode] = false;
        }

        class EncapsulationOff extends Base {
            static [encapsulationMode] = false;
        }

        nodeAssert.doesNotThrow(() => (ContractsOff.new() as any).method());
        nodeAssert.throws(() => { (ContractsOff.new() as any).publicProp = 1; }, TypeError);

        nodeAssert.throws(() => (EncapsulationOff.new() as any).method(), /@ensures failed/);
        nodeAssert.doesNotThrow(() => { (EncapsulationOff.new() as any).publicProp = 1; });
    });

    test('deletion follows encapsulation, not the contracts switch', () => {
        class ContractsOff extends Contracted {
            publicProp = 1;

            static [checkedMode] = false;
        }

        class EncapsulationOff extends Contracted {
            publicProp = 1;

            static [encapsulationMode] = false;
        }

        nodeAssert.throws(() => { delete (ContractsOff.new() as any).publicProp; }, TypeError);
        nodeAssert.doesNotThrow(() => { delete (EncapsulationOff.new() as any).publicProp; });
    });

    test('replacing the prototype follows encapsulation, not the contracts switch', () => {
        class ContractsOff extends Contracted {
            static [checkedMode] = false;
        }

        class EncapsulationOff extends Contracted {
            static [encapsulationMode] = false;
        }

        nodeAssert.throws(() => Object.setPrototypeOf(ContractsOff.new(), {}), TypeError);
        nodeAssert.doesNotThrow(() => Object.setPrototypeOf(EncapsulationOff.new(), {}));
    });
});

describe('The switch cannot be set through an instance', () => {
    class Foo extends Contracted { }

    test('assigning `checkedMode` on an instance is refused', () => {
        nodeAssert.throws(
            () => { (Foo.new() as any)[checkedMode] = false; },
            /Cannot set '.+checkedMode.+' on a Contracted instance/,
        );
    });

    test('assigning `encapsulationMode` on an instance is refused', () => {
        nodeAssert.throws(
            () => { (Foo.new() as any)[encapsulationMode] = false; },
            /Cannot set '.+encapsulationMode.+',? on a Contracted instance/,
        );
    });

    test('the refusal survives both switches being off', () => {
        // The state a caller would most want to escape from is the one where the
        // check is disabled, so the guard is not keyed to either switch.
        class Off extends Contracted {
            static [checkedMode] = false;
            static [encapsulationMode] = false;
        }

        nodeAssert.throws(() => { (Off.new() as any)[checkedMode] = true; }, TypeError);
    });

    test('defining or deleting the switch on an instance is refused', () => {
        nodeAssert.throws(() => Object.defineProperty(Foo.new(), checkedMode, { value: false }), TypeError);
        nodeAssert.throws(() => { delete (Foo.new() as any)[checkedMode]; }, TypeError);
    });

    test('setting the switch on the class still works', () => {
        class Off extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        Off[checkedMode] = false;

        try {
            nodeAssert.doesNotThrow(() => (Off.new() as any).method());
        } finally {
            Off[checkedMode] = true;
        }
    });
});

describe('A switch is inherited, and a subclass declaration shadows it', () => {
    test('the nearest declaration wins', () => {
        class Root extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        class Middle extends Root {
            static [checkedMode] = false;
        }

        class Leaf extends Middle {
            static [checkedMode] = true;
        }

        nodeAssert.throws(() => (Leaf.new() as any).method(), /@ensures failed/);
        nodeAssert.doesNotThrow(() => (Middle.new() as any).method());
        nodeAssert.throws(() => (Root.new() as any).method(), /@ensures failed/);
    });
});

describe('Each contract guard resolves the class chain on its own', () => {
    /*
     * The `get` trap returns every member unwrapped when the contracts are off, so
     * `@demands` and `@ensures` are never reached through the proxy in that state —
     * the trap is what skips them, and the per-guard resolution is unobservable
     * from outside. `@rescue` is reached, because a throwing body still throws
     * whatever the switch says and the rescue guard decides whether to look for a
     * handler.
     *
     * Each guard is still keyed independently on purpose: the trap is a fast path,
     * not the enforcement.
     */
    class Off extends Contracted {
        static [checkedMode] = false;

        @rescue(() => { handlerRan = true; })
        method(): void { throw new Error('boom'); }
    }

    let handlerRan = false;

    test('`applyRescueHandler` rethrows rather than consulting a handler', () => {
        handlerRan = false;

        nodeAssert.throws(() => (Off.new() as any).method(), /boom/);
        nodeAssert.strictEqual(handlerRan, false);
    });
});

describe('The process-wide default is still available', () => {
    test('assigning on `Contracted` affects classes that declare nothing', () => {
        class Foo extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        Contracted[checkedMode] = false;

        try {
            nodeAssert.doesNotThrow(() => (Foo.new() as any).method());
        } finally {
            Contracted[checkedMode] = true;
        }

        nodeAssert.throws(() => (Foo.new() as any).method(), /@ensures failed/);
    });
});
