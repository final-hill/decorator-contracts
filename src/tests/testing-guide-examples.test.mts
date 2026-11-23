import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import {
    AssertionError, Contracted, demands, ensures, getContractMetadata, invariant,
    type ContractViolation,
} from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/328
 *
 * `docs/testing.md` documents the workflow a client uses to shrink an example suite
 * to the scenarios the declarations do not capture. A documented workflow that does
 * not run teaches a shape the library rejects, so the examples are reproduced here:
 * the three roles, the arrange rule, the failure assertion, and the corpus probe.
 *
 * The property-based section is documented rather than mirrored: it needs a generator
 * to be a test at all, and generation is deliberately not a dependency of this
 * library.
 */

/** The failure helper the guide recommends a client keep in their own test tree. */
const violationOf = (fn: () => unknown): ContractViolation => {
    try { fn(); } catch (error) {
        nodeAssert.ok(error instanceof AssertionError, `expected AssertionError, got ${error}`);

        return error.violation as ContractViolation;
    }

    nodeAssert.fail('expected a contract failure');
};

@invariant(({ self }) => !self._onHold || self._holder === undefined)
class Book extends Contracted {
    public _onHold = false;
    public _holder?: string;

    get onHold() { return this._onHold; }
    get holder() { return this._holder; }

    @demands(({ self }) => !self.onHold && self.holder === undefined)
    @ensures(({ self }) => self.onHold && self.holder === undefined)
    placeHold(_patron: string): void { this._onHold = true; }

    @demands(({ self }) => self.onHold)
    @ensures(({ self }) => !self.onHold)
    release(): void { this._onHold = false; }

    @demands(({ self, args: [patron] }) => self.onHold && self.holder !== patron)
    @ensures(({ self, args: [patron] }) => self.holder === patron)
    checkout(patron: string): void { this._onHold = false; this._holder = patron; }
}

class Usage extends Contracted {
    @demands(({ args: [book] }) => !book.onHold)
    @ensures(({ args: [book], oldArgs: [before] }) => book.onHold && !before.onHold)
    holdFor(book: Book, patron: string): void { book.placeHold(patron); }
}

@invariant(({ self }) => self._balance >= 0)
class Account extends Contracted {
    public _balance = 0;

    get balance() { return this._balance; }

    @demands(({ args: [amount] }) => amount > 0)
    @ensures(({ self, args: [amount], old }) => self._balance === old._balance + amount)
    deposit(amount: number): void { this._balance += amount; }

    @demands(({ self, args: [amount] }) => amount <= self._balance)
    withdraw(amount: number): void { this._balance -= amount; }
}

class Counter extends Contracted {
    public _n = 0;

    get n() { return this._n; }

    @demands(({ args: [delta] }) => delta > 0)
    add(delta: number): void { this._n += delta; }
}

describe('The documented roles run as written', () => {
    test('a driver states the cross-object property once', () => {
        const book = Book.new(),
            usage = Usage.new() as Usage;

        usage.holdFor(book, 'ada');

        nodeAssert.strictEqual(book.onHold, true);
    });

    test('the driver\'s pre-state comparison is not vacuous', () => {
        const book = Book.new();

        book.placeHold('ada');

        nodeAssert.throws(() => (Usage.new() as Usage).holdFor(book, 'grace'),
            /@demands failed for Usage\.holdFor/);
    });

    test('`Contracted.new` is required, and the invariant runs once', () => {
        nodeAssert.throws(() => new (Account as any)(), TypeError);
        nodeAssert.strictEqual(Account.new().balance, 0);
    });
});

describe('The documented arrange and assert rules', () => {
    test('a public assignment is refused, a `_` assignment is permitted', () => {
        const account = Account.new() as Account;

        nodeAssert.throws(() => { (account as any).balance = 10; }, TypeError);

        account._balance = 10;
        nodeAssert.strictEqual(account.balance, 10);
    });

    test('the failure names the contract and the feature', () => {
        const account = Account.new();

        account.deposit(5);

        nodeAssert.strictEqual(violationOf(() => account.withdraw(6)).contract, '@demands');
        nodeAssert.strictEqual(violationOf(() => account.withdraw(6)).feature, 'withdraw');
        nodeAssert.throws(() => account.withdraw(6), /@demands failed for Account\.withdraw/);
    });

    test('the invariant is the oracle for a sweep', () => {
        const account = Account.new();

        for (const amount of [10, -1, 5, -20, 3]) {
            try { account.withdraw(amount); } catch { /* refused by @demands */ }
            nodeAssert.ok(account.balance >= 0);
        }
    });
});

describe('The documented enumeration patterns', () => {
    test('a structural test reads the effective contracts', () => {
        const classes = [Account, Book, Counter] as const,
            verbs: Record<string, readonly string[]> = {
                Account: ['deposit', 'withdraw'],
                Book: ['placeHold', 'release'],
                Counter: ['add'],
            };

        for (const Class of classes) {
            const metadata = getContractMetadata(Class);

            for (const verb of verbs[Class.name])
                nodeAssert.ok(
                    (metadata.demands[verb]?.length ?? 0) > 0,
                    `${Class.name}.${verb} declares no precondition`,
                );
        }
    });

    test('a corpus probe lets the declaration decide each verdict', () => {
        const counter = Counter.new() as Counter,
            outcomes = [1, 0, -1, 5].map(value => {
                try { counter.add(value); return `${value}:ok`; }
                catch (error) { return `${value}:${(error as AssertionError).violation?.contract}`; }
            });

        nodeAssert.deepStrictEqual(outcomes, ['1:ok', '0:@demands', '-1:@demands', '5:ok']);
    });

    test('an inherited verb is not reported as undeclared', () => {
        class Savings extends Account {
            @demands(({ args: [rate] }) => rate >= 0)
            accrue(_rate: number): void { }
        }

        const metadata = getContractMetadata(Savings);

        nodeAssert.ok((metadata.demands['deposit']?.length ?? 0) > 0, 'the base arm is effective');
        nodeAssert.ok((metadata.demands['accrue']?.length ?? 0) > 0, 'and the subclass arm');
    });
});
