import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, checkedMode, Contracted, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/283
 */
describe('`invariant` predicates must return a boolean', () => {
    test('an asynchronous predicate is rejected instead of silently passing', () => {
        @invariant(() => Promise.resolve(true) as any)
        class Foo extends Contracted {
            m(): void { }
        }

        // a Promise is truthy, so coercion would have treated the invariant as satisfied
        nodeAssert.throws(
            () => Foo.new(),
            /@invariant predicate #1 for Foo returned a Promise/
        );
    });

    test('a truthy non-boolean is rejected', () => {
        @invariant(() => 1 as any)
        class Foo extends Contracted {
            m(): void { }
        }

        nodeAssert.throws(() => Foo.new(), /returned a number \(1\)/);
    });

    test('the message identifies which invariant in a composition failed', () => {
        @invariant(() => true)
        @invariant(() => 'invalid' as any)
        class Foo extends Contracted {
            m(): void { }
        }

        // the last decorator applied is evaluated first
        nodeAssert.throws(
            () => Foo.new(),
            /@invariant predicate #1 for Foo returned the string "invalid"/
        );
    });

    test('boolean predicates continue to work', () => {
        @invariant(({ self }) => self.value >= 0)
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }
        }

        nodeAssert.doesNotThrow(() => Foo.new());
    });
});

describe('The subclasses of a contracted class must obey the invariants', () => {
    @invariant(({ self: instance }) => instance.value >= 0)
    class Foo extends Contracted {
        protected _value = 0;
        get value() { return this._value; }
        set value(v: number) { this._value = v; }

        inc(): void { this.value++; }
        dec(): void { this.value--; }
    }

    class Bar extends Foo { }

    test('Test subclassing in checked mode', () => {
        nodeAssert.doesNotThrow(() => {
            const bar = Bar.new();
            bar.inc();
            bar.dec();
        });

        nodeAssert.throws(() => {
            const bar = Bar.new();
            bar.dec();
        }, AssertionError);

        nodeAssert.doesNotThrow(() => {
            const bar = Bar.new();
            bar.value = 3;
        });

        nodeAssert.doesNotThrow(() => {
            const bar = Bar.new();

            return bar.value == 0;
        });

        nodeAssert.throws(() => {
            const bar = Bar.new();
            bar.value = -1;
        }, AssertionError);

        // overriding members
        class Baz extends Foo {
            override get value(): number { return super.value; }
            override set value(value: number) { super.value = value; }

            override inc(): void { super.value++; }
            override dec(): void { super.value--; }
        }

        nodeAssert.doesNotThrow(() => {
            const baz = Baz.new();
            baz.inc();
            baz.dec();
        });

        nodeAssert.throws(() => {
            const baz = Baz.new();
            baz.dec();
        }, AssertionError);

        nodeAssert.doesNotThrow(() => {
            const baz = Baz.new();
            baz.value = 3;
        });

        nodeAssert.doesNotThrow(() => {
            const baz = Baz.new();

            return baz.value == 0;
        });

        nodeAssert.throws(() => {
            const baz = Baz.new();
            baz.value = -1;
        }, AssertionError);
    });

    test('Test subclassing in unchecked mode', () => {
        Contracted[checkedMode] = false;

        @invariant(({ self }) => self.value >= 0)
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        class Bar extends Foo { }

        nodeAssert.doesNotThrow(() => {
            const bar = Bar.new();
            bar.inc();
            bar.dec();
        });

        nodeAssert.doesNotThrow(() => {
            const bar = Bar.new();
            bar.dec();
        });

        nodeAssert.doesNotThrow(() => {
            const bar = Bar.new();
            bar.value = 3;
        });

        nodeAssert.doesNotThrow(() => {
            const bar = Bar.new();

            return bar.value == 0;
        });

        nodeAssert.doesNotThrow(() => {
            const bar = Bar.new();
            bar.value = -1;
        });

        Contracted[checkedMode] = true;
    });

    test('Subcontract with private field', () => {
        @invariant(() => true)
        class Base extends Contracted { }

        @invariant(({ self }) => self.value >= 0)
        class Sub extends Base {
            protected _value = 0;
            get value() { return this._value; }
        }

        nodeAssert.doesNotThrow(() =>
            Sub.new()
        );
    });
});

describe('A truthy invariant does not throw an exception when evaluated', () => {
    test('Construction does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            @invariant(({ self }) => self instanceof Foo)
            class Foo extends Contracted { }

            return Foo.new();
        });
        nodeAssert.doesNotThrow(() => {
            @invariant(({ self }) => self instanceof Foo)
            class Foo extends Contracted { }

            return Foo.new();
        });
    });

    test('Method does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            @invariant(({ self }) => self.value >= 0)
            class Foo extends Contracted {
                protected _value = 0;
                get value() { return this._value; }
                set value(v: number) { this._value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = Foo.new();
            foo.inc();
            foo.dec();

            return foo;
        });

        nodeAssert.doesNotThrow(() => {
            @invariant(({ self }) => self.value >= 0)
            class Foo extends Contracted {
                protected _value = 0;
                get value() { return this._value; }
                set value(v: number) { this._value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = Foo.new();
            foo.inc();
            foo.dec();

            return foo;
        });
    });
})

describe('A falsy invariant throws an exception when evaluated', () => {
    test('Construction throws in checkMode', () => {
        nodeAssert.throws(() => {
            @invariant(({ self }) => self instanceof Set)
            class Foo extends Contracted { }

            return Foo.new();
        }, AssertionError);
    });

    test('Construction does not throw in unchecked mode', () => {
        Contracted[checkedMode] = false;

        nodeAssert.doesNotThrow(() => {
            Contracted[checkedMode] = false;

            @invariant(({ self }) => self instanceof Map)
            class Foo extends Contracted { }

            const result = Foo.new();

            Contracted[checkedMode] = true;

            return result

        });

        Contracted[checkedMode] = true;
    });

    test('Method throws in checkMode', () => {
        nodeAssert.throws(() => {
            @invariant(({ self }) => self.value === 37)
            class Foo extends Contracted {
                protected _value = 37;
                get value() { return this._value; }
                set value(v: number) { this._value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = Foo.new();
            foo.inc();
            foo.dec();

            return foo;
        }, AssertionError);
    });

    test('Method does not throw in unchecked mode', () => {
        Contracted[checkedMode] = false;

        nodeAssert.doesNotThrow(() => {
            @invariant(({ self }) => self.value === 37)
            class Foo extends Contracted {
                protected _value = 37;
                get value() { return this._value; }
                set value(v: number) { this._value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            Contracted[checkedMode] = false;

            const foo = Foo.new();
            foo.inc();
            foo.dec();

            Contracted[checkedMode] = true;

            return foo;
        });

        Contracted[checkedMode] = true;
    });
});

describe('Invariants are evaluated after the associated class is constructed', () => {
    test('truthy construction does not throw in checked and unchecked mode', () => {
        nodeAssert.doesNotThrow(() => {
            @invariant(({ self }) => self instanceof Foo)
            class Foo extends Contracted { }

            return Foo.new();
        });

        nodeAssert.doesNotThrow(() => {
            Contracted[checkedMode] = false;

            @invariant(({ self }) => self instanceof Foo)
            class Foo extends Contracted { }

            const result = Foo.new();

            Contracted[checkedMode] = true;

            return result
        });
    });

    test('falsy construction throws in checked mode', () => {
        nodeAssert.throws(() => {
            @invariant(({ self }) => self instanceof Array)
            class Foo extends Contracted { }

            return Foo.new();
        });
    });

    test('falsy construction does not throw in unchecked mode', () => {
        nodeAssert.doesNotThrow(() => {
            Contracted[checkedMode] = false;

            @invariant(({ self }) => self instanceof Error)
            class Foo extends Contracted { }

            const result = Foo.new();

            Contracted[checkedMode] = true;

            return result;
        });
    });
});

describe('An invariant is evaluated before and after every method call on the associated class', () => {
    test('Test method call in checked mode', () => {
        @invariant(({ self }) => self.value >= 0)
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        const foo = Foo.new();

        nodeAssert.doesNotThrow(() => {
            foo.inc();
        });

        nodeAssert.doesNotThrow(() => {
            foo.dec();
        });

        nodeAssert.throws(() => {
            foo.dec();
        }, AssertionError);
    });

    test('Test method call in unchecked mode', () => {
        Contracted[checkedMode] = false;

        @invariant(({ self }) => self.value >= 0)
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        const foo = Foo.new();

        nodeAssert.doesNotThrow(() => {
            foo.inc();
        });

        nodeAssert.doesNotThrow(() => {
            foo.dec();
        });

        nodeAssert.doesNotThrow(() => {
            foo.dec();
        });

        Contracted[checkedMode] = true;
    });
});

describe('In checked mode the invariant is evaluated', () => {
    test('Constructor throws in checkMode', () => {
        nodeAssert.throws(() => {
            @invariant(({ self }) => self instanceof Array)
            class Foo extends Contracted { }

            return Foo.new();
        }, AssertionError);
    });

    test('Method throws in checkMode', () => {
        nodeAssert.throws(() => {
            @invariant(({ self }) => self.value === 37)
            class Foo extends Contracted {
                protected _value = 37;
                get value() { return this._value; }
                set value(v: number) { this._value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = Foo.new();
            foo.inc();
            foo.dec();

            return foo;
        }, AssertionError);
    });

    test('Test getter/setter', () => {
        @invariant(({ self }) => self.value >= 0)
        class Foo extends Contracted {
            protected _value = 0;
            get value() { return this._value; }
            set value(v: number) { this._value = v; }
        }

        const foo = Foo.new();

        nodeAssert.doesNotThrow(() => {
            foo.value = 3;
        }, AssertionError);

        nodeAssert.throws(() => {
            foo.value = -1;
        }, AssertionError);
    });
});

describe('In unchecked mode the invariant is not evaluated', () => {
    test('Construction does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            Contracted[checkedMode] = false;

            @invariant(({ self }) => self instanceof Array)
            class Foo extends Contracted { }

            const result = Foo.new();

            Contracted[checkedMode] = true;

            return result
        });
    });

    test('Method does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            Contracted[checkedMode] = false;

            @invariant(({ self }) => self.value === 42)
            class Foo extends Contracted {
                protected _value = 0;
                get value() { return this._value; }
                set value(v: number) { this._value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = Foo.new();
            foo.inc();
            foo.dec();

            Contracted[checkedMode] = true;

            return foo;
        });
    });
});

describe('A subclass with its own invariants must enforce all ancestor invariants', () => {
    test('Checked Mode', () => {
        nodeAssert.doesNotThrow(() => {
            @invariant(({ self }) => self instanceof Base && self != null)
            class Base extends Contracted { }

            @invariant(({ self }) => self instanceof Sub)
            class Sub extends Base { }

            return Sub.new();
        });

        nodeAssert.throws(() => {
            @invariant(({ self }) => self instanceof Array)
            class Base extends Contracted { }

            @invariant(({ self }) => self instanceof Sub)
            class Sub extends Base { }

            return Sub.new();
        }, AssertionError);

        nodeAssert.doesNotThrow(() => {
            @invariant(({ self }) => self instanceof Base)
            class Base extends Contracted { }

            @invariant(({ self }) => self instanceof Array)
            class Sub extends Base { }

            console.log('Sub:', Sub.name);

            return Base.new();
        });
    });

    test('Unchecked mode both contracts', () => {
        nodeAssert.doesNotThrow(() => {
            Contracted[checkedMode] = false;

            @invariant(() => false)
            class Base extends Contracted { }

            @invariant(() => false)
            class Sub extends Base { }

            const result = Sub.new();

            Contracted[checkedMode] = true;

            return result;
        });
    });

    test('Unchecked mode base contract', () => {
        nodeAssert.doesNotThrow(() => {
            Contracted[checkedMode] = false;

            @invariant(() => false)
            class Base extends Contracted { }

            @invariant(() => true)
            class Sub extends Base { }

            const result = Sub.new();

            Contracted[checkedMode] = true;

            return result
        });
    });

    test('Unchecked mode sub contract', () => {
        nodeAssert.throws(() => {
            @invariant(() => false)
            class Base extends Contracted { }

            @invariant(() => true)
            class Sub extends Base { }

            const result = Sub.new();

            return result;
        }, AssertionError);

        nodeAssert.doesNotThrow(() => {
            Contracted[checkedMode] = false;
            @invariant(() => true)
            class Base extends Contracted { }

            @invariant(() => false)
            class Sub extends Base { }

            const result = Sub.new();
            Contracted[checkedMode] = true;

            return result
        });
    });
});

describe('Third-party features applied to a contracted class are subject to its invariant', () => {
    @invariant(({ self }) => self.value >= 0)
    class Foo extends Contracted {
        protected _value = 0;
        get value() { return this._value; }
        set value(v: number) { this._value = v; }

        inc(): void { this.value++; }
        dec(): void { this.value--; }
    }

    class Bar {
        protected _value = 0;
        get value() { return this._value; }
        set value(v: number) { this._value = v; }

        inc(): void { this.value++; }
        dec(): void { this.value--; }
    }

    test('okay', () => {
        const foo = Foo.new(),
            bar = new Bar();
        bar.inc.apply(foo);

        nodeAssert.strictEqual(foo.value, 1);
    });

    test('failure', () => {
        nodeAssert.throws(() => {
            const foo = Foo.new(),
                bar = new Bar();
            bar.dec.apply(foo);
        }, /^AssertionError: @invariant failed/);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/332
 *
 * `@invariant` is AND-composed, so a throwing arm rejects on its own. Every arm is
 * still evaluated, because an instance can violate several invariants at once and a
 * report naming only the first hides the state the caller has to repair.
 */
describe('A throwing `@invariant` arm rejects without hiding its siblings', () => {
    class Broken extends Error {
        override name = 'Broken';
    }

    test('a throwing arm and a falsy arm are both reported', () => {
        @invariant(() => false)
        @invariant(() => { throw new Broken('no'); })
        class Foo extends Contracted { }

        try {
            Foo.new();
            nodeAssert.fail('expected the invariant to reject construction');
        } catch (caught) {
            const error = caught as any;

            // Compared as a boolean: `nodeAssert.ok(error instanceof Broken)` narrows
            // `error` to `Broken`, which does not declare `violation`.
            nodeAssert.strictEqual(error instanceof Broken, true, 'the thrown value reaches the caller');
            nodeAssert.deepStrictEqual(error.violation.failedIndices, [0, 1]);
            nodeAssert.deepStrictEqual(error.violation.thrownIndices, [0]);
            nodeAssert.strictEqual(error.violation.contract, '@invariant');
            nodeAssert.strictEqual(error.violation.feature, undefined);
        }
    });

    test('a throwing arm rejects even when a sibling arm holds', () => {
        @invariant(() => true)
        @invariant(() => { throw new Broken('no'); })
        class Foo extends Contracted { }

        nodeAssert.throws(() => Foo.new(), (error: any) => error instanceof Broken);
    });

    test('the throw is evaluated on feature entry as well as at construction', () => {
        let evaluations = 0;

        @invariant(() => true)
        @invariant(() => { evaluations++; throw new Broken('no'); })
        class Foo extends Contracted {
            method(): void { }
        }

        // Construction itself runs the invariant once.
        nodeAssert.throws(() => Foo.new(), (error: any) => error instanceof Broken);
        nodeAssert.strictEqual(evaluations, 1);
    });
});
