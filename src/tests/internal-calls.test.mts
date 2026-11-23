import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, demands, ensures, invariant, rescue } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/337
 *
 * A feature body runs against the **raw** instance, so a call it makes on `this`
 * reaches the undecorated function: the callee's `@demands`, `@ensures`, and the
 * `@invariant` around it are all skipped, and only the enclosing feature's
 * boundary is checked.
 *
 * The invariant count alone does not read that; it reads "one lifecycle". These
 * tests read the callee's **own arms**, which is the observable a consumer
 * relies on when they replace a guard call with a contract.
 */
describe('A call on `this` runs none of the callee\'s contracts', () => {
    test('the callee\'s `@demands` is not evaluated', () => {
        let evaluations = 0;

        class Range extends Contracted {
            @demands(({ args: [x] }) => { evaluations++; return x > 0; })
            inner(x: number) { return x; }

            outer(x: number) { return this.inner(x); }
        }

        const range = Range.new() as any;

        nodeAssert.strictEqual(range.outer(-1), -1, 'the enclosing feature accepted it');
        nodeAssert.strictEqual(evaluations, 0, '`inner`\'s precondition never ran');
    });

    test('the callee\'s `@ensures` is not evaluated', () => {
        let evaluations = 0;

        class Range extends Contracted {
            @ensures(({ result }) => { evaluations++; return (result as number) > 0; })
            inner(x: number) { return x; }

            outer(x: number) { return this.inner(x); }
        }

        const range = Range.new() as any;

        // `inner` returns -1, which its own postcondition rejects. Reaching this line
        // at all is the assertion that the postcondition did not run.
        nodeAssert.strictEqual(range.outer(-1), -1);
        nodeAssert.strictEqual(evaluations, 0);
    });

    test('the invariant is evaluated for the enclosing feature only', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Range extends Contracted {
            public _n = 0;

            @demands(() => true)
            inner(): void { }

            @demands(() => true)
            outer(): void { this.inner(); }
        }

        const range = Range.new() as any;
        evaluations = 0;
        range.outer();

        nodeAssert.strictEqual(evaluations, 2, 'entry and exit of `outer`, and nothing else');
    });

    test('a throwing callee is not rescued by the callee\'s own handler', () => {
        const ran: string[] = [];

        class Range extends Contracted {
            @rescue(() => { ran.push('inner'); })
            inner(): void { throw new Error('inner failed'); }

            @rescue(() => { ran.push('outer'); })
            outer(): void { this.inner(); }
        }

        nodeAssert.throws(() => (Range.new() as Range).outer(), { message: 'inner failed' });

        // The throw is `outer`'s body failing, so `outer`'s handler runs; `inner`
        // never had a lifecycle and its handler is not consulted.
        nodeAssert.deepStrictEqual(ran, ['outer']);
    });
});

describe('A call on another instance is a boundary', () => {
    test('the callee\'s `@demands` is evaluated, and rejects a bad argument', () => {
        let evaluations = 0;

        class Range extends Contracted {
            public _n = 0;

            @demands(({ args: [x] }) => { evaluations++; return x > 0; })
            inner(x: number) { return x; }

            viaPeer(peer: Range, x: number) { return peer.inner(x); }
        }

        const caller = Range.new() as any,
            peer = Range.new() as any;

        nodeAssert.throws(() => caller.viaPeer(peer, -1), /@demands failed/);
        nodeAssert.strictEqual(evaluations, 1);
    });

    test('the same object is checked when it is reached through a reference', () => {
        let evaluations = 0;

        class Range extends Contracted {
            public _n = 0;

            @demands(({ args: [x] }) => { evaluations++; return x > 0; })
            inner(x: number) { return x; }

            viaThis(x: number) { return this.inner(x); }
            viaPeer(peer: Range, x: number) { return peer.inner(x); }
        }

        const range = Range.new() as any;

        // What decides is whether the reference reaches the proxy, not whether the
        // instances are equal. Both lines name the same object.
        nodeAssert.strictEqual(range.viaThis(-1), -1);
        nodeAssert.strictEqual(evaluations, 0);

        nodeAssert.throws(() => range.viaPeer(range, -1), /@demands failed/);
        nodeAssert.strictEqual(evaluations, 1);
    });

    test('the calling feature\'s `@rescue` observes the rejection', () => {
        const ran: string[] = [];

        class Range extends Contracted {
            public _n = 0;

            @demands(({ args: [x] }) => x > 0)
            @rescue(() => { ran.push('inner'); })
            inner(x: number) { return x; }

            @rescue(() => { ran.push('outer'); })
            callPeer(peer: Range, x: number) { return peer.inner(x); }
        }

        const caller = Range.new() as any,
            peer = Range.new() as any;

        nodeAssert.throws(() => caller.callPeer(peer, -1), /@demands failed/);

        // The rejection crosses the boundary as a throw into `outer`'s body, so
        // `outer`'s handler sees it. `inner`'s handler ran on `inner`'s own
        // lifecycle, which is not the calling instance's.
        nodeAssert.deepStrictEqual(ran, ['outer']);
    });
});

describe('Either documented shape guards the public verb', () => {
    test('a redundant arm on the delegating verb rejects the call', () => {
        class Repository extends Contracted {
            @demands(({ args: [id] }) => id.length > 0)
            read(id: string): unknown { return { id }; }

            @demands(({ args: [id] }) => id.length > 0)
            describe(id: string): unknown { return this.read(id); }
        }

        nodeAssert.throws(() => (Repository.new() as Repository).describe(''), /@demands failed/);
    });

    test('a public verb guarding an undecorated core rejects the call', () => {
        let coreCalls = 0;

        class Repository extends Contracted {
            @demands(({ args: [id] }) => id.length > 0)
            read(id: string): unknown { return this.core(id); }

            core(id: string): unknown { coreCalls++; return { id }; }
        }

        const repository = Repository.new() as Repository;

        nodeAssert.throws(() => repository.read(''), /@demands failed/);
        nodeAssert.strictEqual(coreCalls, 0, 'the guard rejected before the core ran');
    });
});
