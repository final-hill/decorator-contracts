import { AssertionError, checkedMode, Contracted, demands } from '@final-hill/decorator-contracts';
import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';

describe('Demands assertions can be defined for a class feature', () => {
    test('Basic definition', () => {
        const nonNegative = (self: Foo): boolean => self.value >= 0,
            isEven = (self: Foo): boolean => self.value % 2 == 0

        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }

            @demands((self: Foo) => nonNegative(self) && isEven(self))
            inc(): void { this.value += 2; }

            @demands((self: Foo) => nonNegative(self) && isEven(self))
            dec(): void { this.value -= 1; }
        }

        const foo = Foo.new();

        nodeAssert.doesNotThrow(() => foo.inc());

        nodeAssert.strictEqual(foo.value, 2);

        nodeAssert.throws(() => {
            foo.dec();
            foo.dec();
        }, AssertionError);
    });
});

describe('Overridden features are still subject to the demands assertion', () => {
    class Base extends Contracted {
        protected _value = 0;
        get value() { return this._value; }
        set value(v: number) { this._value = v; }

        @demands((self: Base) => self.value >= 0)
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

    test('dec(); dec(); throws', () => {
        nodeAssert.throws(() => {
            const sub = Sub.new();
            sub.dec();
            sub.dec();
        }, AssertionError);
    });

    class SubSub extends Sub {
        override dec(): void { this.value -= 4; }
    }

    test('inc(); inc(); inc(); inc(): dec(); does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const subSub = SubSub.new();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.dec();
        });
    });

    test('inc(); inc(); inc(); inc(): dec(); dec(); dec(); throws', () => {
        nodeAssert.throws(() => {
            const subSub = SubSub.new();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.inc();
            subSub.dec();
            subSub.dec();
            subSub.dec();
        }, AssertionError);
    });
});

describe('The `demands` assertion is evaluated before its associated feature is called', () => {
    class Foo extends Contracted {
        protected _value = 0;
        get value() { return this._value; }
        set value(v: number) { this._value = v; }
    }

    test('true "demands" check does not throw', () => {
        class Bar extends Foo {
            @demands((self: Bar) => self.value >= 0)
            method(): number {
                return this.value = -2;
            }
        }

        const bar = Bar.new();

        nodeAssert.strictEqual(bar.method(), -2);
    });

    test('false "demands" check throws', () => {
        class Bar extends Foo {
            @demands(() => false)
            method(): number {
                return this.value = 12;
            }
        }

        const bar = Bar.new();

        nodeAssert.throws(() => bar.method());
    });
});

describe('`demands` assertions are enabled in `checkedMode` and disabled otherwise', () => {
    test('The associated assertion is evaluated when checkMode = true', () => {
        class Foo extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method());
    });

    test('The associated assertion is NOT evaluated in checkMode = false', () => {
        class Foo extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        Contracted[checkedMode] = false;
        nodeAssert.doesNotThrow(() => Foo.new().method());
        Contracted[checkedMode] = true;
    });
});


describe('`demands` assertions cannot be strengthened in a subtype', () => {
    class Base extends Contracted {
        @demands((_self, value) => 10 <= value && value <= 30)
        method(value: number): number { return value; }
    }

    test('Base demands', () => {
        const base = Base.new();

        nodeAssert.strictEqual(base.method(15), 15);
        nodeAssert.throws(() => base.method(5), AssertionError);
        nodeAssert.throws(() => base.method(35), AssertionError);
    });

    class Weaker extends Base {
        @demands((_self, value) => 1 <= value && value <= 50)
        override method(value: number): number { return value; }
    }

    test('Weaker precondition', () => {
        const weaker = Weaker.new();

        nodeAssert.strictEqual(weaker.method(15), 15);
        nodeAssert.strictEqual(weaker.method(5), 5);
        nodeAssert.strictEqual(weaker.method(35), 35);
        nodeAssert.throws(() => weaker.method(0), AssertionError);
        nodeAssert.throws(() => weaker.method(60), AssertionError);
    });

    class Stronger extends Base {
        @demands((_self, value) => 15 <= value && value <= 20)
        override method(value: number): number { return value; }
    }

    test('Stronger precondition', () => {
        const stronger = Stronger.new();

        nodeAssert.strictEqual(stronger.method(15), 15);
        nodeAssert.throws(() => stronger.method(5), AssertionError);
        nodeAssert.throws(() => stronger.method(35), AssertionError);
        nodeAssert.strictEqual(stronger.method(25), 25);
    });
});