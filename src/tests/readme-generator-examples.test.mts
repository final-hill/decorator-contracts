import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, Contracted, demands, ensures, invariant, type DemandsSubject, type EnsuresSubject } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/318
 *
 * These mirror the README's "Generators" section, so the documented behaviour is
 * executable rather than aspirational.
 */
describe('README generator examples', () => {
    class Counter extends Contracted {
        protected _count = 0;

        @ensures(({ self, args: [_value], old }: EnsuresSubject<Counter, [number], unknown>) => self._count === old._count + 1)
        *tick(): Generator<number> {
            this._count++;
            yield this._count;
            this._count++;
            yield this._count;
        }
    }

    test('each yielded value must satisfy the postcondition', () => {
        const counter = Counter.new() as Counter;

        nodeAssert.deepEqual([...counter.tick()], [1, 2]);
    });

    @invariant(({ self }) => self._balance >= 0)
    class Ledger extends Contracted {
        protected _balance = 10;

        *payments(): Generator<number> {
            this._balance -= 6;
            yield 6;
            this._balance -= 6;
            yield 6;
        }

        audit(): number { return this._balance; }
    }

    test('a public call between yields sees a valid object', () => {
        const ledger = Ledger.new() as Ledger;
        const iterator = ledger.payments();

        nodeAssert.deepEqual(iterator.next(), { value: 6, done: false });
        nodeAssert.equal(ledger.audit(), 4);

        // The second segment breaks the invariant, and that is reported by the
        // next() that would have delivered it rather than by some later call.
        nodeAssert.throws(() => iterator.next(), AssertionError);
    });

    class Chunks extends Contracted {
        @demands(({ args: [count] }: DemandsSubject<Chunks, [number]>) => count > 0)
        *gen(count: number): Generator<number> {
            for (let i = 0; i < count; i++) yield i;
        }
    }

    test('`for...of` works because no value is injected', () => {
        nodeAssert.deepEqual([...((Chunks.new() as Chunks).gen(3))], [0, 1, 2]);
    });
});
