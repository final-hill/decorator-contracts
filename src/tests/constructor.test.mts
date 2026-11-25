import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { checkedMode, Contracted, contractName, demands, encapsulationMode, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/369
 *
 * `instance.constructor` is the class's **identity**, not a feature. The `get`
 * trap wraps every function it resolves from the prototype chain so a call can be
 * bracketed by contracts, and `constructor` is an own data property of the class's
 * prototype like any other — so an unqualified wrap reported an anonymous wrapper
 * in its place.
 *
 * The consequence is not cosmetic. Code that inspects an instance from outside —
 * a factory validating what it built, a logging wrapper, an error helper naming its
 * subject — reads `instance.constructor.name` and gets `""`, while the same
 * expression inside a method (which runs on the raw target) reports the class. One
 * object, two answers. `instanceof` and the prototype chain were never affected,
 * which is what made the defect hard to see.
 *
 * `constructor` is therefore resolved without a wrapper: there is no contract to
 * bracket, and the `get` trap must answer what the language would.
 */
describe('An instance reports its own constructor', () => {
    test('the constructor read from outside is the class', () => {
        class Probe extends Contracted {
            probe(): string { return 'probe'; }
        }

        const probe = Probe.new();

        nodeAssert.strictEqual((probe as any).constructor, Probe);
    });

    test('the constructor name read from outside is the class name', () => {
        class Probe extends Contracted {
            probe(): string { return 'probe'; }
        }

        nodeAssert.strictEqual((Probe.new() as any).constructor.name, 'Probe');
    });

    test('the outside read and the inside read agree', () => {
        class Probe extends Contracted {
            fromInside(): boolean { return this.constructor === Probe; }
            insideName(): string { return this.constructor.name; }
        }

        const probe = Probe.new();

        nodeAssert.strictEqual((probe as any).constructor, Probe);
        nodeAssert.strictEqual((probe as any).constructor.name, probe.insideName());
        nodeAssert.strictEqual(probe.fromInside(), true);
    });

    test('the constructor the proxy reports is the prototype chain constructor', () => {
        class Probe extends Contracted {
            probe(): string { return 'probe'; }
        }

        const probe = Probe.new();

        nodeAssert.strictEqual((probe as any).constructor, Object.getPrototypeOf(probe).constructor);
        nodeAssert.strictEqual(Object.getPrototypeOf(probe), Probe.prototype);
        nodeAssert.strictEqual(probe instanceof Probe, true);
    });

    test('a subclass reports itself rather than the base it extends', () => {
        class Base extends Contracted {
            base(): string { return 'base'; }
        }

        class Derived extends Base {
            derived(): string { return 'derived'; }
        }

        nodeAssert.strictEqual((Derived.new() as any).constructor, Derived);
        nodeAssert.strictEqual((Derived.new() as any).constructor.name, 'Derived');
        nodeAssert.strictEqual((Base.new() as any).constructor, Base);
    });

    test('reading the constructor is not a contract lifecycle', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Probe extends Contracted {
            probe(): string { return 'probe'; }
        }

        const probe = Probe.new(),
            before = evaluations;

        nodeAssert.strictEqual((probe as any).constructor, Probe);
        nodeAssert.strictEqual(evaluations, before, 'identity is state, not a feature');
    });

    test('a declared name does not change the constructor identity', () => {
        class Probe extends Contracted {
            static [contractName] = 'Renamed';
        }

        const probe = Probe.new();

        nodeAssert.strictEqual((probe as any).constructor, Probe);
        nodeAssert.strictEqual((probe as any).constructor.name, 'Probe', 'the class name is the declaration name');
        nodeAssert.strictEqual(Probe[contractName], 'Renamed');
    });

    test('the identity is the same with either switch off', () => {
        class ChecksOff extends Contracted {
            static [checkedMode] = false;

            @demands(() => false)
            feature(): string { return 'feature'; }
        }

        class EncapsulationOff extends Contracted {
            static [encapsulationMode] = false;
        }

        nodeAssert.strictEqual((ChecksOff.new() as any).constructor, ChecksOff);
        nodeAssert.strictEqual((EncapsulationOff.new() as any).constructor, EncapsulationOff);
    });

    test('a frozen instance still reports its constructor', () => {
        class Probe extends Contracted {
            _v = 0;
        }

        const probe = Probe.new() as any;

        Object.freeze(probe);

        // The trap must return what the property holds when the descriptor is
        // read-only and non-configurable, or the proxy invariant throws.
        nodeAssert.strictEqual(probe.constructor, Probe);
    });

    test('an own constructor shadows the class, as it does on a plain object', () => {
        const replacement = function Replacement(): void { /* stands in for the class */ };

        class Probe extends Contracted {
            _v = 0;
            install(): void { (this as any).constructor = replacement; }
        }

        const probe = Probe.new() as any;

        probe.install();

        nodeAssert.strictEqual(probe.constructor, replacement);
    });
});

/**
 * The exclusion is one key wide. Every other function the chain resolves is still
 * a feature, so the fix must not have widened into "return prototype members raw".
 */
describe('A feature is still wrapped', () => {
    test('a method read is not the raw prototype function', () => {
        class Probe extends Contracted {
            probe(): string { return 'probe'; }
        }

        const probe = Probe.new() as any;

        nodeAssert.notStrictEqual(probe.probe, Probe.prototype.probe);
    });

    test('the wrapper is still stable across reads', () => {
        class Probe extends Contracted {
            probe(): string { return 'probe'; }
        }

        const probe = Probe.new() as any;

        nodeAssert.strictEqual(probe.probe, probe.probe);
    });

    test('a feature is still bracketed by its contracts', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Probe extends Contracted {
            probe(): string { return 'probe'; }
        }

        const probe = Probe.new(),
            before = evaluations;

        probe.probe();

        nodeAssert.ok(evaluations > before, 'the lifecycle ran for the invocation');
    });
});
