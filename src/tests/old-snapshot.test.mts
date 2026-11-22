import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted, ensures } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/282
 */
describe('The `old` instance is a snapshot of the state before the feature ran', () => {
    test('mutable array fields are not shared with the live instance', () => {
        let observedLength: number | undefined,
            sharedReference: boolean | undefined;

        class Bag extends Contracted {
            protected _items: number[] = [];
            get items() { return this._items; }

            @ensures(({ self, old  }) => {
                observedLength = old.items.length;
                sharedReference = old.items === self.items;
                return true;
            })
            add(item: number): void { this._items.push(item); }
        }

        Bag.new().add(1);

        nodeAssert.strictEqual(observedLength, 0);
        nodeAssert.strictEqual(sharedReference, false);
    });

    test('mutable plain object fields are cloned deeply', () => {
        let observed: any;

        class Deep extends Contracted {
            protected _state = { items: [{ n: 1 }], tags: new Set(['a']), when: new Date(0) };
            get state() { return this._state; }

            @ensures(({ old }) => {
                observed = old.state;
                return true;
            })
            mutate(): void {
                this._state.items.push({ n: 2 });
                this._state.tags.add('b');
                this._state.when.setTime(1000);
            }
        }

        Deep.new().mutate();

        nodeAssert.strictEqual(observed.items.length, 1);
        nodeAssert.deepStrictEqual(observed.items, [{ n: 1 }]);
        nodeAssert.strictEqual(observed.tags.size, 1);
        nodeAssert.strictEqual(observed.when.getTime(), 0);
    });

    test('Map fields are cloned', () => {
        let observed: Map<string, number> | undefined;

        class Bag extends Contracted {
            protected _counts = new Map<string, number>();
            get counts() { return this._counts; }

            @ensures(({ old }) => {
                observed = old.counts;
                return true;
            })
            add(key: string): void { this._counts.set(key, (this._counts.get(key) ?? 0) + 1); }
        }

        Bag.new().add('a');

        nodeAssert.strictEqual(observed!.size, 0);
    });

    test('cyclic plain structures are cloned without recursing forever', () => {
        let observedName: string | undefined,
            observedCyclePreserved: boolean | undefined;

        class Node extends Contracted {
            protected _name = 'root';
            protected _state: any = { name: 'root' };
            get name() { return this._name; }
            get state() { return this._state; }

            @ensures(({ old }) => {
                observedName = old.state.name;
                observedCyclePreserved = old.state.self === old.state;
                return true;
            })
            rename(name: string): void {
                this._name = name;
                this._state.name = name;
            }
        }

        const node = Node.new() as any;
        node.state.self = node.state;

        nodeAssert.doesNotThrow(() => node.rename('changed'));
        nodeAssert.strictEqual(observedName, 'root');
        nodeAssert.strictEqual(observedCyclePreserved, true, 'the cycle is preserved in the copy');
    });

    test('prototype getters on `old` read the historical state', () => {
        let observedOld: number | undefined,
            observedSelf: number | undefined;

        class Counter extends Contracted {
            protected _n = 1;
            get n() { return this._n; }

            @ensures(({ self, old  }) => {
                observedOld = old.n;
                observedSelf = self.n;
                return true;
            })
            inc(): void { this._n++; }
        }

        Counter.new().inc();

        nodeAssert.strictEqual(observedOld, 1);
        nodeAssert.strictEqual(observedSelf, 2);
    });

    test('class instances and functions are shared by reference', () => {
        class Child { id = 1; }

        let sameInstance: boolean | undefined,
            sameFunction: boolean | undefined;

        class Holder extends Contracted {
            protected _child = new Child();
            protected _fn = () => 42;
            get child() { return this._child; }
            get fn() { return this._fn; }

            @ensures(({ self, old  }) => {
                sameInstance = old.child === self.child;
                sameFunction = old.fn === self.fn;
                return true;
            })
            touch(): void { this._child.id = 2; }
        }

        Holder.new().touch();

        nodeAssert.strictEqual(sameInstance, true);
        nodeAssert.strictEqual(sameFunction, true);
    });

    test('reading an accessor on the snapshot does not invoke it', () => {
        let observed: unknown;

        class Lazy extends Contracted {
            protected _n = 0;
            get n() { return this._n; }

            @ensures(({ old }) => {
                // an accessor is copied as a descriptor, not evaluated
                observed = Object.getOwnPropertyDescriptor(old, 'lazy')?.value;
                return true;
            })
            compute(): void { this._n++; }

            get lazy() { return this._n; }
        }

        Lazy.new().compute();

        nodeAssert.strictEqual(observed, undefined, 'accessor is not materialised into the snapshot');
    });

    test('the snapshot is taken at call time, not at property access', () => {
        let observed: number | undefined;

        class Counter extends Contracted {
            protected _n = 0;
            get n() { return this._n; }
            set n(value: number) { this._n = value; }

            @ensures(({ old }) => {
                observed = old.n;
                return true;
            })
            bump(): void { this._n += 1; }
        }

        const counter = Counter.new(),
            bump = counter.bump;

        counter.n = 10;
        bump();

        nodeAssert.strictEqual(observed, 10);
    });
});

describe('Reading a method returns a stable reference', () => {
    test('the same instance yields the same wrapper', () => {
        class Foo extends Contracted {
            method(): void { }
        }

        const foo = Foo.new() as any;

        nodeAssert.strictEqual(foo.method, foo.method);

        const first = foo.method;
        const second = foo.method;

        nodeAssert.strictEqual(first, second);
    });

    test('a cached wrapper still enforces the contract', () => {
        class Foo extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        const foo = Foo.new() as any,
            method = foo.method;

        nodeAssert.throws(() => method(), /@ensures failed/);
    });

    test('different instances yield different wrappers', () => {
        class Foo extends Contracted {
            method(): void { }
        }

        const a = Foo.new() as any,
            b = Foo.new() as any;

        nodeAssert.notStrictEqual(a.method, b.method);
    });
});
