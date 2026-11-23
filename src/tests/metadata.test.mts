import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, getContractMetadata, getFeatureContracts, invariant, rescue } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/335
 *
 * `Contracted[Symbol.metadata]` was a working introspection surface with a wrong
 * published type: it declared `DemandsPredicate[]` where the decorators store
 * `{ arm, options }`. A consumer writing `metadata.demands.foo[0](self)` compiled
 * and then threw at runtime.
 *
 * These pin the published types against the values the decorators actually store,
 * and the accessors that make the surface safe to read.
 */

const ARM_A = (_self: Contracted) => true;
const ARM_B = (_self: Contracted) => true;

describe('The declared metadata types match what the decorators store', () => {
    test('a demand entry is `{ arm, options }`, not a bare predicate', () => {
        class Foo extends Contracted {
            @demands(ARM_A)
            m(): void { }
        }

        const entry = getContractMetadata(Foo).demands['m'][0];

        // The bug: `Predicate[]` said this was callable.
        nodeAssert.strictEqual(typeof entry, 'object');
        nodeAssert.strictEqual(entry.arm, ARM_A, 'the arm is the predicate the consumer declared');
    });

    test('an ensures entry carries the options it was declared with', () => {
        class Foo extends Contracted {
            @ensures(ARM_A)
            m(): void { }
        }

        const entry = getContractMetadata(Foo).ensures['m'][0];

        nodeAssert.strictEqual(entry.arm, ARM_A);
        nodeAssert.strictEqual(entry.options, undefined, 'no options means the field is absent, not a placeholder');
    });

    test('an invariant entry is `{ arm }`, keyed by nothing', () => {
        @invariant(ARM_A)
        class Foo extends Contracted { }

        const [entry] = getContractMetadata(Foo).invariants;

        nodeAssert.strictEqual(entry.arm, ARM_A);
    });

    test('a rescue entry is a single declaration, not a list', () => {
        const handler = () => { };

        class Foo extends Contracted {
            @rescue(handler)
            m(): void { }
        }

        const declaration = getContractMetadata(Foo).rescue['m'];

        nodeAssert.strictEqual(declaration.handler, handler);
        nodeAssert.strictEqual(Array.isArray(declaration), false, 'one feature has one handler');
    });
});

describe('Effective arms are reported in evaluation order', () => {
    test('inherited arms come before the subclass arms', () => {
        class Base extends Contracted {
            public _n = 0;

            @demands(ARM_A)
            m(): void { this._n++; }
        }

        class Sub extends Base {
            @demands(ARM_B)
            override m(): void { this._n++; }
        }

        const arms = getFeatureContracts(Sub, 'm').demands;

        nodeAssert.deepStrictEqual(
            arms.map(entry => entry.arm),
            [ARM_A, ARM_B],
            'the base arm is inherited first, then the subclass arm',
        );
    });

    test('within one class the arms are in reverse source order', () => {
        class Foo extends Contracted {
            public _n = 0;

            // Top decorator runs last: decorators evaluate bottom-up.
            @demands(ARM_A)
            @demands(ARM_B)
            m(): void { this._n++; }
        }

        nodeAssert.deepStrictEqual(
            getFeatureContracts(Foo, 'm').demands.map(entry => entry.arm),
            [ARM_B, ARM_A],
        );
    });

    test('a feature with no contract reports empty lists, not undefined', () => {
        class Foo extends Contracted {
            declared(): void { }
            undeclared(): void { }
        }

        const contracts = getFeatureContracts(Foo, 'undeclared');

        nodeAssert.deepStrictEqual(contracts.demands, []);
        nodeAssert.deepStrictEqual(contracts.ensures, []);
        nodeAssert.strictEqual(contracts.rescue, undefined);
        nodeAssert.deepStrictEqual(contracts, { ...contracts, demands: [], ensures: [] });
    });

    test('a class that declares nothing reports an empty record', () => {
        class Plain extends Contracted { }

        const metadata = getContractMetadata(Plain);

        nodeAssert.deepStrictEqual(metadata.invariants, []);
        nodeAssert.deepStrictEqual(metadata.demands, {});
        nodeAssert.deepStrictEqual(metadata.ensures, {});
        nodeAssert.deepStrictEqual(metadata.rescue, {});
        nodeAssert.strictEqual(metadata.classRescue, undefined);
    });

    test('`Contracted` itself has no metadata', () => {
        nodeAssert.strictEqual(Contracted[Symbol.metadata], undefined);
        nodeAssert.deepStrictEqual(getContractMetadata(Contracted).demands, {});
    });
});

describe('Metadata cannot be mutated through the public surface', () => {
    const HANDLER = () => { };

    class Subject extends Contracted {
        public _n = 0;

        @demands(ARM_A)
        @rescue(HANDLER)
        m(): void { this._n++; }
    }

    @invariant(ARM_A)
    class WithInvariant extends Subject { }

    test('the returned lists are frozen', () => {
        const metadata = getContractMetadata(WithInvariant);

        nodeAssert.strictEqual(Object.isFrozen(metadata.invariants), true);
        nodeAssert.strictEqual(Object.isFrozen(metadata.demands['m']), true);
        nodeAssert.strictEqual(Object.isFrozen(metadata.demands), true);
    });

    test('pushing a fabricated arm is refused', () => {
        const metadata = getContractMetadata(WithInvariant) as any;

        nodeAssert.throws(() => metadata.demands['m'].push({ arm: () => false }));
        nodeAssert.throws(() => metadata.invariants.push({ arm: () => false }));
    });

    test('replacing a feature entry is refused', () => {
        const metadata = getContractMetadata(WithInvariant) as any;

        nodeAssert.throws(() => { metadata.demands['m'] = [{ arm: () => false }]; });
        nodeAssert.throws(() => { metadata.rescue['m'] = { handler: () => { } }; });
    });

    test('the class keeps the contracts it was defined with', () => {
        const metadata = getContractMetadata(WithInvariant) as any;

        nodeAssert.throws(() => metadata.demands['m'].push({ arm: () => false }));

        // A mutation attempt must not have reached the record the runtime reads.
        nodeAssert.strictEqual(getFeatureContracts(WithInvariant, 'm').demands.length, 1);
        nodeAssert.strictEqual(getContractMetadata(WithInvariant).invariants.length, 1);
    });

    test('an entry cannot have its arm replaced', () => {
        /*
         * Freezing the array is shallow. Without copying each entry, `entry.arm = …`
         * writes through to the record the runtime consults, so a "read" API could
         * disable the precondition it was asked to report on.
         */
        const metadata = getContractMetadata(WithInvariant) as any;

        nodeAssert.strictEqual(Object.isFrozen(metadata.demands['m'][0]), true, 'the entry itself is frozen');
        nodeAssert.strictEqual(Object.isFrozen(metadata.invariants[0]), true);
        nodeAssert.throws(() => { metadata.demands['m'][0].arm = () => false; });
        nodeAssert.throws(() => { metadata.invariants[0].arm = () => false; });
    });

    test('a rescue declaration cannot have its bounds changed', () => {
        const metadata = getContractMetadata(WithInvariant) as any,
            feature = getFeatureContracts(WithInvariant, 'm') as any;

        nodeAssert.throws(() => { metadata.rescue['m'].maxRetries = 0; });
        nodeAssert.throws(() => { metadata.rescue['m'].handler = () => { }; });
        nodeAssert.throws(() => { feature.rescue.maxRetries = 0; });
    });

    test('an entry\'s options cannot be edited', () => {
        /*
         * `options` travels with the arm and the runtime reads it: `normalize`
         * decides whether the caller receives the raw result or the schema's
         * replacement. Sharing the options object would let a "read" API change what
         * a feature returns.
         */
        const normalize = {
            '~standard': {
                version: 1 as const,
                vendor: 'test',
                validate: (value: unknown) => ({ value: String(value).trim() }),
            },
        };

        class Normalizing extends Contracted {
            @ensures(normalize as any, { normalize: true })
            m(): string { return '  padded  '; }
        }

        const entry = (getContractMetadata(Normalizing) as any).ensures['m'][0];

        nodeAssert.strictEqual(Object.isFrozen(entry.options), true, 'the options object is copied and frozen');
        nodeAssert.throws(() => { entry.options.normalize = false; });
        nodeAssert.strictEqual(
            (Normalizing.new() as Normalizing).m(),
            'padded',
            'the declared normalization still applies to the caller',
        );
    });

    test('the rescue declaration object is not the live one', () => {
        const metadata = getContractMetadata(WithInvariant) as any,
            live = (WithInvariant as any)[Symbol.metadata].rescue['m'];

        nodeAssert.notStrictEqual(metadata.rescue['m'], live, 'a copy, not the live declaration');
        nodeAssert.strictEqual(metadata.rescue['m'].handler, live.handler, 'the handler keeps its identity');
    });

    test('tampering cannot weaken the contract the runtime enforces', () => {
        /*
         * The observable the criterion names is the arm the runtime evaluates, not
         * the length of the list holding it. This asserts the behaviour: a
         * precondition that refuses the second call still refuses it after every
         * mutation the accessor's surface allows.
         */
        class Guard extends Contracted {
            public _n = 0;

            @demands(({ self }) => self._n < 1)
            inc(): void { this._n++; }
        }

        const metadata = getContractMetadata(Guard) as any;

        for (const attempt of [
            () => { metadata.demands['inc'][0].arm = () => true; },
            () => { metadata.demands['inc'].push({ arm: () => true }); },
            () => { metadata.demands['inc'] = [{ arm: () => true }]; },
        ]) nodeAssert.throws(attempt, 'every mutation is refused');

        const guard = Guard.new() as Guard;

        guard.inc();
        nodeAssert.throws(() => guard.inc(), /@demands failed/, 'the declared precondition still holds');
    });

    test('each call returns its own copy, so one caller cannot affect another', () => {
        const first = getContractMetadata(Subject),
            second = getContractMetadata(Subject);

        nodeAssert.notStrictEqual(first.demands, second.demands, 'the record is copied per call');
        nodeAssert.notStrictEqual(first.demands['m'][0], second.demands['m'][0], 'the entry is copied too');
        nodeAssert.strictEqual(
            first.demands['m'][0].arm,
            second.demands['m'][0].arm,
            'but the declared arm keeps its identity',
        );
    });
});
