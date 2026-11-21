import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/188
 *
 * These mirror the README's "Asynchronous features" section, so the documented
 * behaviour is executable rather than aspirational.
 */
describe('README asynchronous feature examples', () => {
    interface Ledger {
        record(amount: number): Promise<void>;
    }

    class Account extends Contracted {
        protected _balance = 0;
        public _ledger!: Ledger;

        get balance() { return this._balance; }

        // Seeding is an ordinary feature call: an externally-written field has
        // to satisfy the invariant, so the fixture must not bypass the proxy.
        seed(balance: number): void { this._balance = balance; }

        @demands((self: Account, [amount]: [number]) => self.balance + amount >= 0)
        @ensures((self: Account, [amount]: [number], old: Account) => self.balance === old.balance + amount)
        async deposit(amount: number): Promise<void> {
            await this._ledger.record(amount);
            this._balance += amount;
        }
    }

    const makeAccount = (balance = 0, log: number[] = []): Account => {
        const account = Account.new() as Account;

        account._ledger = { record: async amount => { await Promise.resolve(); log.push(amount); } };
        account.seed(balance);

        return account;
    };

    test('the postcondition observes the balance after the await', async () => {
        const log: number[] = [],
            account = makeAccount(10, log);

        await account.deposit(5);

        nodeAssert.equal(account.balance, 15);
        nodeAssert.deepEqual(log, [5]);
    });

    test('a violated precondition rejects rather than throws', async () => {
        const account = makeAccount(0);

        await nodeAssert.rejects(() => account.deposit(-5), AssertionError);
        nodeAssert.equal(account.balance, 0);
    });

    test('`@invariant` brackets the suspended body', async () => {
        const balances: number[] = [];

        @invariant(function (self: Guarded) { balances.push(self.value); return self.value >= 0; })
        class Guarded extends Contracted {
            protected _value = 0;
            get value() { return this._value; }

            async drain(): Promise<void> {
                await Promise.resolve();
                this._value = -1;
            }
        }

        const guarded = Guarded.new() as Guarded;

        // `Contracted.new()` checks the invariant once after construction, so
        // record only the evaluations that belong to the call itself.
        balances.length = 0;

        await nodeAssert.rejects(() => guarded.drain(), AssertionError);
        nodeAssert.deepEqual(balances, [0, -1], 'entry then exit, across the suspension');
    });
});
