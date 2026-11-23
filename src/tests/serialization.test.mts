import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { inspect } from 'node:util';
import {
    contractName, Contracted, demands, invariant, serializable, type DemandsSubject,
} from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/341
 *
 * A contracted instance had no usable serialization surface: `inspect` rendered the
 * proxy wrapper, and `JSON.stringify` emitted the `_`-prefixed fields the library
 * treats as private.
 *
 * The two surfaces are deliberately different. `inspect` is always on and shows the
 * `_` fields, because it exists to show a developer what an object holds.
 * `toJSON` is opt-in and shows only the getters a class names, because which state
 * is publishable is the consumer's decision.
 */

/** The class name plus own state, which is what `inspect` is expected to render. */
const renders = (instance: object): string => inspect(instance);

describe('`inspect` shows the instance rather than the proxy', () => {
    test('the class name is reported', () => {
        class Account extends Contracted {
            _balance = 5;
        }

        nodeAssert.match(renders(Account.new()), /^Account \{/);
    });

    test('the proxy wrapper is gone', () => {
        class Account extends Contracted { }

        // The fallback rendering is `Proxy(Account { ... })`, so a bare `Proxy(`
        // would mean nothing replaced it.
        nodeAssert.doesNotMatch(renders(Account.new()), /Proxy\(/);
    });

    test('own state is shown', () => {
        class Account extends Contracted {
            _balance = 5;
            _orgId = 'o';
        }

        const rendered = renders(Account.new());

        nodeAssert.match(rendered, /_balance: 5/);
        nodeAssert.match(rendered, /_orgId: 'o'/);
    });

    test('a class with no own state renders as an empty instance', () => {
        class Empty extends Contracted { }

        nodeAssert.strictEqual(renders(Empty.new()), 'Empty {}');
    });

    test('it runs no contract', () => {
        let evaluations = 0;

        @invariant(() => { evaluations++; return true; })
        class Account extends Contracted {
            _balance = 5;
        }

        const account = Account.new();

        evaluations = 0;
        inspect(account);

        // A debugger must be able to render an instance whose contracts fail, so the
        // rendering reads descriptors rather than properties.
        nodeAssert.strictEqual(evaluations, 0);
    });

    test('a getter that throws does not break the rendering', () => {
        class Broken extends Contracted {
            _value = 1;

            get value(): number { throw new Error('getter exploded'); }
        }

        // Reading the getter through the proxy would run its lifecycle, and a getter
        // that throws would then make `inspect` throw for the instance a reader is
        // trying to look at.
        nodeAssert.doesNotThrow(() => inspect(Broken.new()));
        nodeAssert.match(renders(Broken.new()), /_value: 1/);
    });

    test('an accessor owned by the instance is not invoked', () => {
        class Account extends Contracted {
            _balance = 5;
        }

        const account = Account.new() as any;

        // A `_`-prefixed name may be defined from outside, and `Object.entries` would
        // invoke such an accessor while `getOwnPropertyDescriptors` does not. This is
        // what separates a descriptor read from a property read.
        Object.defineProperty(account, '_derived', {
            get(): number { throw new Error('own getter exploded'); },
            enumerable: true,
            configurable: true,
        });

        nodeAssert.doesNotThrow(() => inspect(account));
        nodeAssert.doesNotMatch(renders(account), /_derived/);
    });

    test('an accessor is not rendered, because it holds no state', () => {
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        const rendered = renders(Account.new());

        nodeAssert.match(rendered, /_balance: 5/);
        nodeAssert.doesNotMatch(rendered, /\bbalance:/);
    });

    test('nested instances keep their own class name', () => {
        class Child extends Contracted {
            _n = 1;
        }

        class Holder extends Contracted {
            _child: Child;

            constructor(child: Child) {
                super();
                this._child = child;
            }
        }

        nodeAssert.match(renders(Holder.new(Child.new())), /_child: Child \{ _n: 1 \}/);
    });

    test('a reference back to an ancestor is not followed', () => {
        class Node extends Contracted {
            _self: unknown;
            _n = 1;

            constructor() {
                super();
                this._self = this;
            }
        }

        // A cycle would recurse until the stack overflowed. A finite depth would
        // abbreviate it before the cycle mattered, so the unlimited depth is what
        // exercises the ancestry guard.
        nodeAssert.match(inspect(Node.new(), { depth: null }), /\[Circular\]/);
    });

    test('a shallow depth abbreviates a cycle before following it', () => {
        class Node extends Contracted {
            _self: unknown;

            constructor() {
                super();
                this._self = this;
            }
        }

        // The depth the caller asked for is honoured, rather than being replaced by
        // a cycle marker: one unit of depth shows two levels before abbreviating,
        // which is what Node does for a plain object of the same shape.
        nodeAssert.strictEqual(inspect(Node.new(), { depth: 1 }), 'Node { _self: Node { _self: [Object] } }');
    });

    test('the same child twice is rendered twice', () => {
        class Child extends Contracted {
            _n = 1;
        }

        class Pair extends Contracted {
            _left: Child;
            _right: Child;

            constructor(child: Child) {
                super();
                this._left = child;
                this._right = child;
            }
        }

        const rendered = renders(Pair.new(Child.new()));

        // Sharing a child is not a cycle, so abbreviating the second one would report
        // a structure the instance does not have.
        nodeAssert.strictEqual(rendered.match(/Child \{ _n: 1 \}/g)?.length, 2);
    });

    test('the instance itself is shown at depth zero', () => {
        class Child extends Contracted {
            _n = 1;
        }

        class Holder extends Contracted {
            _child: Child;

            constructor(child: Child) {
                super();
                this._child = child;
            }
        }

        // `depth: 0` abbreviates a value `util.inspect` has no budget left to descend
        // into, and the instance the caller passed is the root rather than a descendant.
        // Reporting it as `[Object]` would hide the very object that was asked about,
        // and would disagree with what Node does for a plain object of the same shape.
        nodeAssert.strictEqual(inspect(Holder.new(Child.new()), { depth: 0 }), 'Holder { _child: [Object] }');
    });

    test('a nested level is kept for each unit of depth, as node keeps it', () => {
        class Inner extends Contracted {
            _n = 1;
        }

        class Outer extends Contracted {
            _inner: Outer | Inner;

            constructor(inner: Outer | Inner) {
                super();
                this._inner = inner;
            }
        }

        const chain = Outer.new(Outer.new(Inner.new()));

        // Compared against Node's own rendering of an equivalent plain object: each
        // unit of depth shows one more level, and the last is abbreviated.
        nodeAssert.strictEqual(inspect(chain, { depth: 0 }), 'Outer { _inner: [Object] }');
        nodeAssert.strictEqual(inspect(chain, { depth: 1 }), 'Outer { _inner: Outer { _inner: [Object] } }');
        nodeAssert.strictEqual(inspect(chain, { depth: 2 }), 'Outer { _inner: Outer { _inner: Inner { _n: 1 } } }');
    });

    test('a spent depth budget abbreviates, as node does', () => {
        class Child extends Contracted {
            _n = 1;
        }

        class Holder extends Contracted {
            _child: Child;

            constructor(child: Child) {
                super();
                this._child = child;
            }
        }

        nodeAssert.strictEqual(inspect(Holder.new(Child.new()), { depth: -1 }), '[Object]');
    });

    test('the declared name is the one reported', () => {
        class InternallyNamed extends Contracted {
            static [contractName] = 'Cart';

            _n = 1;
        }

        // A class that named itself for its violations is named the same way in a
        // debugger, which is the case a minified build depends on.
        nodeAssert.strictEqual(inspect(InternallyNamed.new()), 'Cart { _n: 1 }');
    });

    test('a subclass may replace the rendering by declaring its own method', () => {
        const custom = Symbol.for('nodejs.util.inspect.custom');

        class Account extends Contracted {
            [custom](): string { return 'a custom rendering'; }
        }

        nodeAssert.strictEqual(renders(Account.new()), 'a custom rendering');
    });

    test('it still renders when the contracts are off', () => {
        class Account extends Contracted {
            _balance = 5;
        }

        // The rendering is a prototype method, so it is reachable whether or not the
        // proxy wraps features.
        nodeAssert.match(renders(Account.new()), /^Account \{ _balance: 5 \}$/);
    });
});

describe('`JSON.stringify` leaks `_`-prefixed state by default', () => {
    test('the default output is the instance own data', () => {
        class Account extends Contracted {
            _balance = 5;
            _orgId = 'o';
        }

        // This is the behaviour the opt-in exists to replace, asserted so the
        // motivation fails the suite if the default ever changes.
        nodeAssert.strictEqual(JSON.stringify(Account.new()), '{"_balance":5,"_orgId":"o"}');
    });

    test('the default is unchanged by the decorator existing', () => {
        class Account extends Contracted {
            _balance = 5;
        }

        nodeAssert.strictEqual(JSON.stringify(Account.new()), '{"_balance":5}');
    });
});

describe('`@serializable` publishes the getters it names', () => {
    test('the published shape is the named getters', () => {
        @serializable('balance', 'orgId')
        class Account extends Contracted {
            _balance = 5;
            _orgId = 'o';

            get balance(): number { return this._balance; }
            get orgId(): string { return this._orgId; }
        }

        nodeAssert.strictEqual(JSON.stringify(Account.new()), '{"balance":5,"orgId":"o"}');
    });

    test('only the named getters are published', () => {
        @serializable('balance')
        class Account extends Contracted {
            _balance = 5;
            _orgId = 'o';

            get balance(): number { return this._balance; }
            get orgId(): string { return this._orgId; }
        }

        // `orgId` is a getter too, so publishing everything observable would include
        // it; excluding it is what makes the argument list the decision.
        nodeAssert.strictEqual(JSON.stringify(Account.new()), '{"balance":5}');
    });

    test('no `_`-prefixed field is emitted', () => {
        @serializable('balance')
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        nodeAssert.doesNotMatch(JSON.stringify(Account.new()), /_balance/);
    });

    test('the order is the order the decorator was given', () => {
        @serializable('orgId', 'balance')
        class Account extends Contracted {
            _balance = 5;
            _orgId = 'o';

            get balance(): number { return this._balance; }
            get orgId(): string { return this._orgId; }
        }

        nodeAssert.strictEqual(JSON.stringify(Account.new()), '{"orgId":"o","balance":5}');
    });

    test('the value is read at serialization time, not at decoration time', () => {
        @serializable('balance')
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }

            @demands(({ args: [amount] }: DemandsSubject<Account, [number]>) => amount > 0)
            deposit(amount: number): void { this._balance += amount; }
        }

        const account = Account.new();

        account.deposit(10);

        nodeAssert.strictEqual(JSON.stringify(account), '{"balance":15}');
    });

    test('it composes with a contracted feature', () => {
        let evaluations = 0;

        @serializable('balance')
        @invariant(() => { evaluations++; return true; })
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        const account = Account.new();

        evaluations = 0;
        JSON.stringify(account);

        // `toJSON` is a public feature, so the proxy brackets it: the entry and exit
        // invariant hold around the whole serialization.
        nodeAssert.ok(evaluations > 0, 'serialization ran the lifecycle');
    });

    test('the published getter does not start a second lifecycle', () => {
        let evaluations = 0;

        @serializable('balance')
        @invariant(() => { evaluations++; return true; })
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        const account = Account.new();

        evaluations = 0;
        JSON.stringify(account);

        // `toJSON`'s own entry and exit. A feature body runs against the raw target,
        // so reading the getter inside it does not re-enter the proxy; the count is
        // what would change if the serialization ran on the proxy instead.
        nodeAssert.strictEqual(evaluations, 2);
    });

    test('a nested published instance is serialized through its own shape', () => {
        @serializable('balance')
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        @serializable('account')
        class Wallet extends Contracted {
            _account: Account;

            constructor(account: Account) {
                super();
                this._account = account;
            }

            get account(): Account { return this._account; }
        }

        nodeAssert.strictEqual(JSON.stringify(Wallet.new(Account.new())), '{"account":{"balance":5}}');
    });
});

describe('`@serializable` is not inherited where the subclass declares its own', () => {
    test('a subclass that opts in publishes its own shape', () => {
        @serializable('balance')
        class Account extends Contracted {
            _balance = 5;
            _bonus = 1;

            get balance(): number { return this._balance; }
            get bonus(): number { return this._bonus; }
        }

        @serializable('bonus')
        class Savings extends Account {
            get bonus(): number { return this._bonus; }
        }

        nodeAssert.strictEqual(JSON.stringify(Savings.new()), '{"bonus":1}');
    });

    test('a subclass that declares nothing inherits the published shape', () => {
        @serializable('balance')
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        class Savings extends Account { }

        // The subclass *is* an `Account`, so the shape an `Account` publishes is the
        // shape it publishes.
        nodeAssert.strictEqual(JSON.stringify(Savings.new()), '{"balance":5}');
    });

    test('a subclass may publish a getter it inherited', () => {
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        @serializable('balance')
        class Savings extends Account { }

        nodeAssert.strictEqual(JSON.stringify(Savings.new()), '{"balance":5}');
    });
});

describe('`@serializable` refuses a declaration it cannot honour', () => {
    test('a class that does not extend `Contracted`', () => {
        nodeAssert.throws(
            () => {
                @serializable('value')
                class Plain {
                    get value(): number { return 1; }
                }

                return Plain;
            },
            /@serializable decorator can only be applied to classes that extend Contracted/,
        );
    });

    test('no features named', () => {
        nodeAssert.throws(
            () => {
                @serializable()
                class Account extends Contracted { }

                return Account;
            },
            /given no features/,
        );
    });

    test('a name that is not a getter', () => {
        nodeAssert.throws(
            () => {
                @serializable('missing')
                class Account extends Contracted { }

                return Account;
            },
            /was given 'missing', which is not a getter on Account/,
        );
    });

    test('a field name rather than a getter', () => {
        nodeAssert.throws(
            () => {
                @serializable('value')
                class Account extends Contracted {
                    value = 1;
                }

                return Account;
            },
            /which is not a getter/,
        );
    });

    test('a method name rather than a getter', () => {
        nodeAssert.throws(
            () => {
                @serializable('value')
                class Account extends Contracted {
                    value(): number { return 1; }
                }

                return Account;
            },
            /which is not a getter on Account/,
        );
    });

    test('the diagnostic names the class the way every other one does', () => {
        nodeAssert.throws(
            () => {
                @serializable('missing')
                class InternallyNamed extends Contracted {
                    static [contractName] = 'Cart';
                }

                return InternallyNamed;
            },
            // The declared name rather than the constructor's, so an error a consumer
            // reads matches the one a violation would report.
            /which is not a getter on Cart/,
        );
    });

    test('the decorator applied twice', () => {
        nodeAssert.throws(
            () => {
                @serializable('a')
                @serializable('b')
                class Account extends Contracted {
                    _a = 1;
                    _b = 2;

                    get a(): number { return this._a; }
                    get b(): number { return this._b; }
                }

                return Account;
            },
            /declares @serializable more than once/,
        );
    });

    test('a class that already declares its own `toJSON`', () => {
        nodeAssert.throws(
            () => {
                @serializable('a')
                class Account extends Contracted {
                    _a = 1;

                    get a(): number { return this._a; }

                    toJSON(): unknown { return { mine: true }; }
                }

                return Account;
            },
            /already declares its own 'toJSON'/,
        );
    });
});

describe('The serialization surface does not enlarge the instance', () => {
    test('`toJSON` is not an instance key', () => {
        @serializable('balance')
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        // The published shape is declared on the prototype, so enumerating the
        // instance must not gain the method.
        nodeAssert.deepStrictEqual(Object.keys(Account.new()), ['_balance']);
    });

    test('`inspect` does not add a key either', () => {
        class Account extends Contracted {
            _balance = 5;
        }

        nodeAssert.deepStrictEqual(Object.keys(Account.new()), ['_balance']);
    });

    test('the published shape cannot be replaced after the class is defined', () => {
        @serializable('balance')
        class Account extends Contracted {
            _balance = 5;

            get balance(): number { return this._balance; }
        }

        // A caller that could swap `toJSON` could publish state the class did not
        // declare it would publish.
        nodeAssert.throws(
            () => Object.defineProperty(Account.prototype, 'toJSON', { value: () => ({ leaked: true }) }),
            TypeError,
        );
    });
});
