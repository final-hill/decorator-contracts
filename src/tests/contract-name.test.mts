import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import {
    AssertionError, contractName, Contracted, demands, ensures, invariant, type ContractViolation,
} from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/339
 *
 * `className` is read from the constructor, so it is only as stable as the name the
 * consumer's build emitted. The standard decorator lowering wraps a decorated class
 * in an immediately invoked arrow that returns a class expression, and a compressor
 * is free to leave that expression anonymous — measured: `className` becomes `''`
 * and the message reads `@demands failed for .withdraw`.
 *
 * A declaration is the only signal that survives a build, so these tests pin the
 * declaration, its scope, and its precedence over the emitted name.
 */

const capture = (fn: () => unknown): AssertionError => {
    try {
        fn();
    } catch (error) {
        nodeAssert.ok(error instanceof AssertionError, `expected an AssertionError, got ${error}`);
        return error;
    }

    nodeAssert.fail('expected a contract failure');
};

const violationOf = (fn: () => unknown): ContractViolation => {
    const violation = capture(fn).violation;

    nodeAssert.ok(violation, 'expected the failure to describe a violation');

    return violation;
};

/**
 * Reproduces what a minifier does to a decorated class.
 *
 * The standard lowering wraps the class in an immediately invoked arrow that returns
 * a class expression, which a compressor is free to leave anonymous. The empty name
 * is produced directly rather than by running a minifier, so the tests state the
 * condition a declaration has to survive without depending on which bundler a
 * consumer chose.
 */
const withoutAName = <T extends typeof Contracted>(Class: T): T => {
    Object.defineProperty(Class, 'name', { value: '', configurable: true });

    return Class;
};

describe('A class names itself in a violation', () => {
    test('a declared name is what `className` reports', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @demands(() => false)
            withdraw(): void { }
        }

        nodeAssert.strictEqual(violationOf(() => Cart.new().withdraw()).className, 'Cart');
    });

    test('the declared name reaches the message, not just the payload', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @demands(() => false)
            withdraw(): void { }
        }

        nodeAssert.match(capture(() => Cart.new().withdraw()).message, /^@demands failed for Cart\.withdraw/);
    });

    test('`@invariant` reports the declared name', () => {
        @invariant(() => false)
        class Ledger extends Contracted {
            static [contractName] = 'Ledger';
        }

        const violation = violationOf(() => Ledger.new());

        nodeAssert.strictEqual(violation.contract, '@invariant');
        nodeAssert.strictEqual(violation.className, 'Ledger');
    });

    test('`@ensures` reports the declared name', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @ensures(() => false)
            total(): number { return 0; }
        }

        nodeAssert.strictEqual(violationOf(() => Cart.new().total()).className, 'Cart');
    });

    test('a declaration is not the class name, so the two disagree when they differ', () => {
        // The assertion is only meaningful if the fallback would have said something
        // else; a test that declared its own name as the class name would pass with
        // the resolution removed.
        class InternallyMangledName extends Contracted {
            static [contractName] = 'Cart';

            @demands(() => false)
            withdraw(): void { }
        }

        const violation = violationOf(() => InternallyMangledName.new().withdraw());

        nodeAssert.strictEqual(violation.className, 'Cart');
        nodeAssert.notStrictEqual(violation.className, InternallyMangledName.name);
    });
});

describe('A class without a declared name reports its constructor name', () => {
    test('the fallback is the name the build emitted', () => {
        class Cart extends Contracted {
            @demands(() => false)
            withdraw(): void { }
        }

        // `Cart.name` equals the literal too, so asserting only that the two agree
        // would pass for a hardcoded string. Renaming the constructor is what makes
        // the assertion read the fallback rather than a constant.
        withoutAName(Cart);
        Object.defineProperty(Cart, 'name', { value: 'EmittedName', configurable: true });

        nodeAssert.strictEqual(violationOf(() => Cart.new().withdraw()).className, 'EmittedName');
    });

    test('`Contracted` itself needs no declaration to be named', () => {
        class Base extends Contracted {
            @demands(() => false)
            m(): void { }
        }

        nodeAssert.strictEqual(violationOf(() => Base.new().m()).className, Base.name);
    });
});

describe('A declared name is not inherited', () => {
    test('a subclass that declares nothing reports itself', () => {
        class Base extends Contracted {
            static [contractName] = 'Base';
        }

        class Derived extends Base {
            @demands(() => false)
            withdraw(): void { }
        }

        // The base's name describes the base. Applying it to the subclass would make
        // a failure in `Derived` read as a failure in `Base`.
        nodeAssert.strictEqual(violationOf(() => Derived.new().withdraw()).className, Derived.name);
    });

    test('a subclass may declare its own name', () => {
        class Base extends Contracted {
            static [contractName] = 'Base';
        }

        class Derived extends Base {
            static [contractName] = 'Derived';

            @demands(() => false)
            withdraw(): void { }
        }

        nodeAssert.strictEqual(violationOf(() => Derived.new().withdraw()).className, 'Derived');
    });

    test('the base still reports its own declaration', () => {
        class Base extends Contracted {
            static [contractName] = 'Base';

            @demands(() => false)
            withdraw(): void { }
        }

        class Derived extends Base { }

        nodeAssert.strictEqual(violationOf(() => Base.new().withdraw()).className, 'Base');
        nodeAssert.strictEqual(violationOf(() => Derived.new().withdraw()).className, Derived.name);
    });
});

describe('A declaration that cannot name anything falls back', () => {
    test('an empty string is not a name', () => {
        class Cart extends Contracted {
            static [contractName] = '';

            @demands(() => false)
            withdraw(): void { }
        }

        // An empty name would render the message as `@demands failed for .withdraw`,
        // which is the degraded output this declaration exists to prevent.
        nodeAssert.strictEqual(violationOf(() => Cart.new().withdraw()).className, Cart.name);
    });

    test('a non-string declaration is not a name', () => {
        class Cart extends Contracted {
            static [contractName] = 42 as unknown as string;

            @demands(() => false)
            withdraw(): void { }
        }

        nodeAssert.strictEqual(violationOf(() => Cart.new().withdraw()).className, Cart.name);
    });
});

describe('A declaration survives a build that stripped the constructor name', () => {
    test('the declared name is what a violation reports', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @demands(() => false)
            withdraw(): void { }
        }

        withoutAName(Cart);

        const violation = violationOf(() => Cart.new().withdraw());

        nodeAssert.strictEqual(violation.className, 'Cart');
        nodeAssert.match(capture(() => Cart.new().withdraw()).message, /^@demands failed for Cart\.withdraw/);
    });

    test('`@invariant` and `@ensures` use the declaration too', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @ensures(() => false)
            total(): number { return 0; }
        }

        @invariant(() => false)
        class Ledger extends Contracted {
            static [contractName] = 'Ledger';
        }

        withoutAName(Cart);
        withoutAName(Ledger);

        nodeAssert.strictEqual(violationOf(() => Cart.new().total()).className, 'Cart');
        nodeAssert.strictEqual(violationOf(() => Ledger.new()).className, 'Ledger');
    });

    test('without a declaration the name is empty, which is why one is needed', () => {
        class Cart extends Contracted {
            @demands(() => false)
            withdraw(): void { }
        }

        withoutAName(Cart);

        // The degraded output the declaration exists to replace. Asserting it keeps
        // the motivation honest: if the fallback were fixed some other way, this test
        // would fail and the documentation would have to change with it.
        const violation = violationOf(() => Cart.new().withdraw());

        nodeAssert.strictEqual(violation.className, '');
        nodeAssert.match(capture(() => Cart.new().withdraw()).message, /^@demands failed for \.withdraw/);
    });
});

describe('The declaration names the class in a predicate diagnostic', () => {
    /**
     * An arm that returns a non-boolean is reported against a label built from the
     * class name, before any violation exists. A name that only reached the violation
     * would leave this message describing the minifier's output.
     */
    test('`@demands`', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @demands(() => 'no' as unknown as boolean)
            withdraw(): void { }
        }

        withoutAName(Cart);

        nodeAssert.throws(
            () => Cart.new().withdraw(),
            /@demands predicate #1 for Cart\.withdraw returned the string "no"/,
        );
    });

    test('`@ensures`', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @ensures(() => 1 as unknown as boolean)
            total(): number { return 0; }
        }

        withoutAName(Cart);

        nodeAssert.throws(
            () => Cart.new().total(),
            /@ensures predicate #1 for Cart\.total returned a number \(1\)/,
        );
    });

    test('`@invariant`', () => {
        @invariant(() => 'no' as unknown as boolean)
        class Ledger extends Contracted {
            static [contractName] = 'Ledger';
        }

        withoutAName(Ledger);

        nodeAssert.throws(
            () => Ledger.new(),
            /@invariant predicate #1 for Ledger returned the string "no"/,
        );
    });
});

describe('The declaration reaches the `onViolation` factory', () => {
    test('the factory receives a violation naming the class', () => {
        let received: ContractViolation | undefined;

        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @demands(() => false, {
                onViolation: violation => {
                    received = violation;

                    return new Error('typed');
                },
            })
            withdraw(): void { }
        }

        withoutAName(Cart);

        nodeAssert.throws(() => Cart.new().withdraw(), /typed/);
        nodeAssert.ok(received, 'the factory ran');
        nodeAssert.strictEqual(received.className, 'Cart');
        nodeAssert.strictEqual(received.feature, 'withdraw');
    });
});

describe('The declaration names the class when a feature returns a promise', () => {
    test('the message is labelled with the declared name', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @demands(() => true)
            load(): Promise<number> {
                return Promise.resolve(1);
            }
        }

        withoutAName(Cart);

        // This message is raised by the proxy rather than by a contract, so it builds
        // its own label and would otherwise name the minifier's output.
        nodeAssert.throws(
            () => (Cart.new() as any).load(),
            /Cart\.load returned a promise but is not declared 'async'/,
        );
    });
});

describe('The declaration is read only to label a failure', () => {
    /**
     * `assertInvariants` runs on entry and exit of every feature, so an invariant
     * label resolved unconditionally charges a declaration twice per call for a
     * value nothing consumes. A declaration may be an accessor, so this is
     * observable: the read count separates the two implementations.
     *
     * Each case drives ten calls of the feature it declares and reports the reads
     * per call, so the two classes may name their feature differently.
     */
    const readsPerCall = (drive: (counter: { reads: number }) => () => void): number => {
        const counter = { reads: 0 },
            call = drive(counter);

        counter.reads = 0;

        for (let invocation = 0; invocation < 10; invocation++) call();

        return counter.reads / 10;
    };

    test('a class with no invariant arms pays only for the contract that names it', () => {
        // One read per call is `@demands` building its label. Were the invariant
        // check to resolve the name too, this would be three.
        const reads = readsPerCall(counter => {
            class Cart extends Contracted {
                static get [contractName](): string { counter.reads++; return 'Cart'; }

                @demands(() => true)
                withdraw(): void { }
            }

            const cart = Cart.new() as any;

            return () => cart.withdraw();
        });

        nodeAssert.strictEqual(reads, 1);
    });

    test('a class with an invariant arm pays for the entry and exit checks', () => {
        // The contrast is what makes the first test meaningful rather than a
        // tautology: the declaration is reachable, and an arm is what adds the two.
        const reads = readsPerCall(counter => {
            @invariant(() => true)
            class Ledger extends Contracted {
                static get [contractName](): string { counter.reads++; return 'Ledger'; }

                @demands(() => true)
                deposit(): void { }
            }

            const ledger = Ledger.new() as any;

            return () => ledger.deposit();
        });

        nodeAssert.strictEqual(reads, 3);
    });
});

describe('The declaration is read from the class, like the enforcement switches', () => {
    test('an instance write changes the instance, not the class', () => {
        class Cart extends Contracted {
            static [contractName] = 'Cart';

            @demands(() => false)
            withdraw(): void { }
        }

        const cart = Cart.new() as any;

        // The write is refused by no trap — the symbol is not a `set` target the
        // encapsulation rule covers — so it lands on the raw target. What keeps the
        // name intact is that the resolver reads the class, which the write does not
        // reach. Asserting both halves is what distinguishes that from a trap refusal.
        cart[contractName] = 'Tampered';

        nodeAssert.strictEqual(cart[contractName], 'Tampered', 'the write reached the instance');
        nodeAssert.strictEqual(Cart[contractName], 'Cart', 'the class is unchanged');
        nodeAssert.strictEqual(violationOf(() => cart.withdraw()).className, 'Cart');
    });

    test('a throwing declaration does not replace the contract failure', () => {
        class Cart extends Contracted {
            static get [contractName](): string { throw new Error('boom'); }

            @demands(() => false)
            withdraw(): void { }
        }

        // A name is read on the way to reporting a failure, so a declaration that
        // throws must not become the error the caller receives instead of it.
        const violation = violationOf(() => Cart.new().withdraw());

        nodeAssert.strictEqual(violation.contract, '@demands');
        nodeAssert.strictEqual(violation.className, Cart.name);
    });

    test('the symbol is published and stable across copies of the library', () => {
        // `Symbol.for` rather than `Symbol`: a consumer that reads the symbol from one
        // installed copy must still reach the key the runtime reads.
        nodeAssert.strictEqual(contractName, Symbol.for('Contracted.contractName'));
    });
});
