import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, getContractMetadata } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/368
 *
 * A `protected` or `private` keyword member is an ordinary public property in the
 * emitted JavaScript, and a standard decorator context reports `private: false` for
 * it. The `_` prefix is therefore the only visibility the runtime can act on, and it
 * is the only one the placement gate refuses.
 *
 * A contract on a non-public keyword member is consequently accepted, and it is
 * evaluated at a boundary that is reached: an external cast, or a subclass method
 * reading `peer.member`. The usual `this.member` is not a boundary, so a member
 * reached only that way has an arm nothing evaluates.
 *
 * These tests pin both halves: the diagnostic states the rule it enforces, and the
 * arm is live rather than silently dropped.
 */

/** A standard member context, so the diagnostics are exercised without a compiler. */
const context = (overrides: Record<string, unknown> = {}): any => ({
    kind: 'getter',
    name: 'feature',
    static: false,
    private: false,
    metadata: {},
    access: {},
    addInitializer: () => { },
    ...overrides,
});

describe('A `_`-prefixed name is the visibility the runtime acts on', () => {
    test('the diagnostic names the `_` prefix, not a keyword modifier it cannot see', () => {
        nodeAssert.throws(
            () => demands(() => true)(() => 0, context({ name: '_hidden' })),
            (error: any) => /cannot be applied to a '_'-prefixed feature/.test(error.message)
                && !/private\/protected/.test(error.message),
        );
    });

    test('a `protected` getter is accepted, because the modifier is not observable', () => {
        // No throw: the context reports `private: false`, exactly as a public getter's
        // does, so the gate has nothing to refuse.
        nodeAssert.doesNotThrow(() => demands(() => true)(() => 0, context({ name: 'b' })));
    });

    test('a native `#private` member is still refused', () => {
        nodeAssert.throws(
            () => demands(() => true)(() => 0, context({ name: '#b', private: true })),
            /cannot be applied to private features/,
        );
    });
});

describe('A contract on a non-public keyword member is enforced only at a boundary', () => {
    let armRuns = 0;

    class Mixed extends Contracted {
        @demands(() => { armRuns++; return false })
        protected get prot(): number { return 1 }

        @demands(() => { armRuns++; return false })
        private get priv(): number { return 2 }

        readProt(): number { return this.prot; }

        static make() { return super.new() as Mixed }
    }

    test('the arm is registered, so a structural test sees the declaration', () => {
        nodeAssert.deepStrictEqual(Object.keys(getContractMetadata(Mixed).demands).sort(), ['priv', 'prot']);
    });

    test('an internal call runs none of the arm', () => {
        const mixed = Mixed.make() as any;

        armRuns = 0;

        nodeAssert.strictEqual(mixed.readProt(), 1, 'the read succeeded');
        nodeAssert.strictEqual(armRuns, 0, "the callee's precondition never ran");
    });

    test('a boundary that is reached refuses the call', () => {
        const mixed = Mixed.make() as any;

        armRuns = 0;

        // The modifier is erased, so the property is reachable at runtime; reading it
        // through the proxy is a boundary, and the arm that always fails refuses it.
        nodeAssert.throws(() => mixed.prot, /@demands failed/);
        nodeAssert.throws(() => mixed.priv, /@demands failed/);
        nodeAssert.strictEqual(armRuns, 2);
    });
});

describe('A peer reference is the one boundary a non-public member has', () => {
    let armRuns = 0;

    class Base extends Contracted {
        @demands(() => { armRuns++; return true })
        protected get prot(): number { return 1 }

        static make() { return super.new() as Base }
    }

    class Sub extends Base {
        readSelf(): number { return this.prot; }
        readPeer(peer: Sub): number { return peer.prot; }
    }

    test('`this.prot` starts no lifecycle', () => {
        const sub = Sub.make() as Sub;

        armRuns = 0;
        sub.readSelf();

        nodeAssert.strictEqual(armRuns, 0);
    });

    test('`peer.prot` is a proxy read, so the arm evaluates', () => {
        const sub = Sub.make() as Sub;

        armRuns = 0;
        nodeAssert.strictEqual(sub.readPeer(sub), 1);

        nodeAssert.strictEqual(armRuns, 1, 'the peer reference crossed the proxy');
    });
});
