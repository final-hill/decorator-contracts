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

/**
 * https://github.com/final-hill/decorator-contracts/issues/283
 */
describe('`demands` predicates must return a boolean', () => {
    test('an asynchronous predicate is rejected instead of silently passing', () => {
        class Foo extends Contracted {
            @demands(() => Promise.resolve(true) as any)
            method(): void { }
        }

        // a Promise is truthy, so coercion would have treated this as satisfied
        nodeAssert.throws(
            () => Foo.new().method(),
            /@demands predicate #1 for Foo\.method returned a Promise/
        );
    });

    test('an asynchronous predicate returning false is rejected, not accepted', () => {
        class Foo extends Contracted {
            @demands(() => Promise.resolve(false) as any)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method(), AssertionError);
    });

    test('a truthy string is rejected', () => {
        class Foo extends Contracted {
            @demands(() => 'false' as any)
            method(): void { }
        }

        nodeAssert.throws(
            () => Foo.new().method(),
            /returned the string "false"/
        );
    });

    test('a truthy object is rejected', () => {
        class Foo extends Contracted {
            @demands(() => ({ satisfied: true }) as any)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method(), /returned an object/);
    });

    test('`undefined` is rejected with a specific message', () => {
        class Foo extends Contracted {
            @demands(() => undefined as any)
            method(): void { }
        }

        nodeAssert.throws(() => Foo.new().method(), /returned undefined/);
    });

    test('the message identifies which predicate in a composition failed', () => {
        class Foo extends Contracted {
            @demands((_self: Foo, [value]: [number]) => value > 0)
            @demands(() => 'invalid' as any)
            method(value: number): number { return value; }
        }

        // the last decorator applied is evaluated first
        nodeAssert.throws(
            () => Foo.new().method(-1),
            /@demands predicate #1 for Foo\.method returned the string "invalid"/
        );
    });

    test('boolean predicates continue to work', () => {
        class Foo extends Contracted {
            @demands((_self: Foo, [value]: [number]) => value > 0)
            method(value: number): number { return value; }
        }

        nodeAssert.strictEqual(Foo.new().method(3), 3);
        nodeAssert.throws(() => Foo.new().method(0), /No demands were satisfied/);
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

/**
 * https://github.com/final-hill/decorator-contracts/issues/284
 */
describe('Predicates are registered once, not once per instantiation', () => {
    const predicatesOf = (Class: any, key: 'demands' | 'ensures', name: string): unknown[] =>
        Class[Symbol.metadata][key][name] ?? [];

    test('the predicate list does not grow with instantiation count', () => {
        class Foo extends Contracted {
            @demands(() => true)
            method(): void { }
        }

        Foo.new();
        const initial = predicatesOf(Foo, 'demands', 'method').length;

        for (let i = 0; i < 100; i++) Foo.new();

        nodeAssert.strictEqual(predicatesOf(Foo, 'demands', 'method').length, initial);
    });

    test('a predicate is evaluated once per call regardless of instance count', () => {
        let evaluations = 0;

        class Foo extends Contracted {
            @demands(() => { evaluations++; return true; })
            method(): void { }
        }

        for (let i = 0; i < 50; i++) Foo.new();

        evaluations = 0;
        Foo.new().method();

        nodeAssert.strictEqual(evaluations, 1);
    });

    test('stacked declarations are all retained', () => {
        class Foo extends Contracted {
            @demands(() => false)
            @demands(() => true)
            method(): void { }
        }

        nodeAssert.strictEqual(predicatesOf(Foo, 'demands', 'method').length, 2);
        // demands are OR-composed, so the true one satisfies the obligation
        nodeAssert.doesNotThrow(() => Foo.new().method());
    });

    test('a subclass still composes its predicates with the base class', () => {
        const evaluated: string[] = [];

        class Base extends Contracted {
            @demands((_self: Base, [v]: [number]) => { evaluated.push('base:' + v); return false; })
            foo(v: number): number { return v; }
        }

        class Sub extends Base {
            @demands((_self: Sub, [v]: [number]) => { evaluated.push('sub:' + v); return false; })
            override foo(v: number): number { return v; }
        }

        nodeAssert.throws(() => Sub.new().foo(1));
        nodeAssert.deepStrictEqual(evaluated, ['base:1', 'sub:1']);
    });

    test('decorating a class that does not extend Contracted is rejected', () => {
        nodeAssert.throws(() => {
            class NotContracted {
                @demands(() => true)
                method(): void { }
            }

            return new NotContracted();
        }, /can only be applied to classes that extend Contracted/);
    });
});


describe('`demands` assertions cannot be strengthened in a subtype', () => {
    class Base extends Contracted {
        @demands((_self, [value]: [number]) => 10 <= value && value <= 30)
        method(value: number): number { return value; }
    }

    test('Base demands', () => {
        const base = Base.new();

        nodeAssert.strictEqual(base.method(15), 15);
        nodeAssert.throws(() => base.method(5), AssertionError);
        nodeAssert.throws(() => base.method(35), AssertionError);
    });

    class Weaker extends Base {
        @demands((_self, [value]: [number]) => 1 <= value && value <= 50)
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
        @demands((_self, [value]: [number]) => 15 <= value && value <= 20)
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