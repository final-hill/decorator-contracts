import { AssertionError, checkedMode, Contracted, ensures } from '@final-hill/decorator-contracts';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

describe('Ensures assertions can be defined for a class feature', () => {
    test('Basic Definition', () => {
        const nonNegative = (self: Foo): boolean => self.value >= 0,
            isEven = (self: Foo): boolean => self.value % 2 == 0

        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(val: number) { this._value = val; }

            @ensures((self: Foo) => nonNegative(self) && isEven(self))
            inc(): void { this.value += 2; }

            @ensures((self: Foo) => nonNegative(self) && isEven(self))
            dec(): void { this.value -= 1; }
        }

        const foo = Foo.new();

        nodeAssert.doesNotThrow(() => foo.inc());

        nodeAssert.strictEqual(foo.value, 2);

        nodeAssert.throws(() => {
            foo.dec();
        }, AssertionError);
    });
});

describe('Overridden features are still subject to the ensures assertion ', () => {
    class Base extends Contracted {
        private _value = 0;
        get value() { return this._value; }
        set value(val: number) { this._value = val; }

        @ensures((self: Base) => self.value >= 0)
        dec(): void { this.value--; }
        inc(): void { this.value++; }
    }

    class Sub extends Base {
        override dec(): void { this.value -= 2; }
    }

    test('inc(); inc(); dec(); does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const sub = Sub.new();
            sub.inc();
            sub.inc();
            sub.dec();
        });
    });

    test('dec(); throws', () => {
        nodeAssert.throws(() => {
            const sub = Sub.new();
            sub.dec();
        });
    });
});

describe('The ensures assertion is evaluated after its associated feature is called', () => {
    class Foo extends Contracted {
        private _value = 0;
        get value() { return this._value; }
        set value(val: number) { this._value = val; }
    }

    test('true @ensures check does not throw', () => {
        class Bar extends Foo {
            @ensures((self: Bar) => self.value >= 0)
            method(): number { return this.value = 2; }
        }

        const bar = Bar.new();

        nodeAssert.strictEqual(bar.method(), 2);
    });

    test('false @ensures check throws', () => {
        class Bar extends Foo {
            @ensures(_self => false)
            method(): number { return this.value = 12; }
        }
        const bar = Bar.new();

        nodeAssert.throws(() => { bar.method(); });
    });
});

describe('`ensures` assertions are enabled in checkedMode and disabled otherwise', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        class Foo extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method());
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        Contracted[checkedMode] = false;

        class Foo extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        nodeAssert.doesNotThrow(() => Foo.new().method());

        Contracted[checkedMode] = true;
    });
});

describe('Postconditions cannot be weakened in a subtype', () => {
    class Base extends Contracted {
        @ensures((_self, [value]) => 10 <= value && value <= 30)
        method(value: number): number { return value; }
    }

    test('Base postcondition', () => {
        const base = Base.new();

        nodeAssert.strictEqual(base.method(15), 15);
        nodeAssert.strictEqual(base.method(25), 25);
        nodeAssert.throws(() => base.method(5), AssertionError);
        nodeAssert.throws(() => base.method(35), AssertionError);
    });

    class Weaker extends Base {
        @ensures((_self, [value]) => 1 <= value && value <= 50)
        override method(value: number): number { return value; }
    }

    test('Weaker postcondition', () => {
        const weaker = Weaker.new();

        nodeAssert.strictEqual(weaker.method(15), 15);
        nodeAssert.strictEqual(weaker.method(25), 25);
        nodeAssert.throws(() => weaker.method(5), AssertionError);
        nodeAssert.throws(() => weaker.method(35), AssertionError);
    });

    class Stronger extends Base {
        @ensures((_self, [value]) => 15 <= value && value <= 20)
        override method(value: number): number { return value; }
    }

    test('Stronger postcondition', () => {
        const stronger = Stronger.new();

        nodeAssert.strictEqual(stronger.method(15), 15);
        nodeAssert.strictEqual(stronger.method(20), 20);
        nodeAssert.throws(() => stronger.method(25), AssertionError);
        nodeAssert.throws(() => stronger.method(5), AssertionError);
        nodeAssert.throws(() => stronger.method(35), AssertionError);
    });
});

describe('ensures has access to the properties of the instance class before its associated member was executed', () => {
    test('Stack Size', () => {
        class Stack<T> extends Contracted {
            private _implementation: T[] = [];
            private _size = 0;

            get size() { return this._size; }

            @ensures((self: Stack<T>, _args, old) => self.size == old.size - 1)
            pop(): T {
                const result = this._implementation.pop()!;
                this._size = this._implementation.length;

                return result;
            }

            @ensures((self: Stack<T>, _args, old) => self.size == old.size + 1)
            push(item: T): void {
                this._implementation.push(item);
                this._size = this._implementation.length;
            }
        }

        const stack = Stack.new() as Stack<string>;

        nodeAssert.strictEqual(stack.size, 0);
        nodeAssert.doesNotThrow(() => {
            stack.push('a');
            stack.push('b');
            stack.push('c');
        });
        nodeAssert.doesNotThrow(() => stack.pop());
        nodeAssert.strictEqual(stack.size, 2);
    });
});