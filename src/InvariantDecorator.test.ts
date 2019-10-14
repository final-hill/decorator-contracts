/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit tests for the invariant decorator
 */
import Contracts from './';
import AssertionError from './AssertionError';

/**
 * Requirement 132
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/132
 */
describe('The invariant decorator MUST be class decorator only', () => {
    let {invariant} = new Contracts(true);

    test('Define invariant', () => {
        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            class Foo {}

            return Foo;
        }).not.toThrow();

        expect(() => {
            class Foo {
                // @ts-ignore : Raises a type error as expected.
                @invariant<Foo>(self => self instanceof Foo)
                baz() {}
            }

            return Foo;
        }).toThrow();
    });
});

/**
 * Requirement 133
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/133
 */
describe('There can be multiple invariant decorators assigned to a class', () => {
    let invariants = [
        new Contracts(true).invariant,
        new Contracts(false).invariant
    ];

    invariants.forEach(invariant => {
        test('Define multiple invariants', () => {
            expect(() => {
                @invariant<Foo>(self => self instanceof Foo)
                @invariant<Foo>(self => self instanceof Object)
                class Foo extends Object {}

                return Foo;
            }).not.toThrow();

            expect(() => {
                @invariant<Foo>(self => self instanceof Foo)
                @invariant<Foo>(self => self instanceof Array)
                class Foo extends Object {}

                return Foo;
            }).not.toThrow();
        });
    });

    test('Constructing with multiple invariants in debug mode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            @invariant<Foo>(self => self instanceof Object)
            class Foo extends Object {}

            return new Foo();
        }).not.toThrow();

        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            @invariant<Foo>(self => self instanceof Array)
            class Foo extends Object {}

            return new Foo();
        }).toThrow(AssertionError);

        // Changing order of invariants
        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            @invariant<Foo>(self => self instanceof Foo)
            class Foo extends Object {}

            return new Foo();
        }).toThrow(AssertionError);
    });

    test('Constructing with multiple invariants in prod mode', () => {
        let {invariant} = new Contracts(false);

        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            @invariant<Foo>(self => self instanceof Object)
            class Foo extends Object {}

            return new Foo();
        }).not.toThrow();

        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            @invariant<Foo>(self => self instanceof Array)
            class Foo extends Object {}

            return new Foo();
        }).not.toThrow();

        // Changing order of invariants
        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            @invariant<Foo>(self => self instanceof Foo)
            class Foo extends Object {}

            return new Foo();
        }).not.toThrow(AssertionError);
    });
});

/**
 * Requirement 134
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/134
 */
describe('The subclasses of an invariant decorated class must obey the invariant', () => {
    test('Test subclassing in debug mode', () => {
        let {invariant} = new Contracts(true);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            protected _value: number = 0;
            get value() { return this._value; }
            set value(value: number) { this._value = value; }
            inc() { this._value++; }
            dec() { this._value--; }
        }

        class Bar extends Foo {}

        expect(() => {
            let bar = new Bar();
            bar.inc();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            let bar = new Bar();
            bar.dec();
        }).toThrow(AssertionError);

        expect(() => {
            let bar = new Bar();
            bar.value = 3;
        }).not.toThrow();

        expect(() => {
            let bar = new Bar();

            return bar.value == 0;
        }).not.toThrow(AssertionError);

        expect(() => {
            let bar = new Bar();
            bar.value = -1;
        }).toThrow(AssertionError);

        // overriding members
        class Baz extends Foo {
            get value() { return this._value; }
            set value(value: number) { this._value = value; }
            inc() { this._value++; }
            dec() { this._value--; }
        }

        expect(() => {
            let baz = new Baz();
            baz.inc();
            baz.dec();
        }).not.toThrow();

        expect(() => {
            let baz = new Baz();
            baz.dec();
        }).toThrow(AssertionError);

        expect(() => {
            let baz = new Baz();
            baz.value = 3;
        }).not.toThrow();

        expect(() => {
            let baz = new Baz();

            return baz.value == 0;
        }).not.toThrow(AssertionError);

        expect(() => {
            let baz = new Baz();
            baz.value = -1;
        }).toThrow(AssertionError);
    });

    test('Test subclassing in prod mode', () => {
        let {invariant} = new Contracts(false);
        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            protected _value: number = 0;
            get value() { return this._value; }
            set value(value: number) { this._value = value; }
            inc() { this._value++; }
            dec() { this._value--; }
        }

        class Bar extends Foo {}

        expect(() => {
            let bar = new Bar();
            bar.inc();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            let bar = new Bar();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            let bar = new Bar();
            bar.value = 3;
        }).not.toThrow();

        expect(() => {
            let bar = new Bar();

            return bar.value == 0;
        }).not.toThrow(AssertionError);

        expect(() => {
            let bar = new Bar();
            bar.value = -1;
        }).not.toThrow(AssertionError);
});
});

/**
 * Requirement 135
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/135
 */
describe('A truthy invariant does not throw an exception when evaluated', () => {
    let invariants = [
        new Contracts(true).invariant,
        new Contracts(false).invariant
    ];

    invariants.forEach(invariant => {
        test('Construction does not throw', () => {
            expect(() => {
                @invariant<Foo>(self => self instanceof Foo)
                class Foo {}

                return new Foo();
            }).not.toThrow();
        });

        test('Method does not throw', () => {
            expect(() => {
                @invariant<Foo>(self => self.value >= 0)
                class Foo {
                    protected value: number = 0;

                    dec() { this.value--; }
                    inc() { this.value++; }
                }

                let foo = new Foo();
                foo.inc();
                foo.dec();

                return foo;
            }).not.toThrow();
        });
    });
});

/**
 * Requirement 136
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/136
 */
describe('A falsy invariant throws an exception when evaluated', () => {

    test('Construction throws in debugMode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).toThrow(AssertionError);
    });

    test('Construction does not throw in production mode', () => {
        let {invariant} = new Contracts(false);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

    test('Method throws in debugMode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self.value === 37)
            class Foo {
                protected value: number = 37;

                dec() { this.value--; }
                inc() { this.value++; }
            }

            let foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }).toThrow(AssertionError);
    });

    test('Method does not throw in production mode', () => {
        let {invariant} = new Contracts(false);

        expect(() => {
            @invariant<Foo>(self => self.value === 37)
            class Foo {
                protected value: number = 37;

                dec() { this.value--; }
                inc() { this.value++; }
            }

            let foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }).not.toThrow();
    });
});

/**
 * Requirement 137
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/137
 */
describe('An invariant is evaluated after it\'s associated class is constructed', () => {
    test('truthy construction does not throw in debug and prod mode', () => {
        let invariants = [
            new Contracts(true).invariant,
            new Contracts(false).invariant
        ];

        invariants.forEach(invariant => {
            expect(() => {
                @invariant<Foo>(self => self instanceof Foo)
                class Foo {}

                return new Foo();
            }).not.toThrow();
        });
    });

    test('falsy construction throws in debug mode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).toThrow();
    });

    test('falsy construction does not throw in prod mode', () => {
        let {invariant} = new Contracts(false);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

});

/**
 * Requirement 138
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/138
 */
describe('An invariant is evaluated before and after every method call on the associated class', () => {
    test('Test method call in debugMode', () => {
        let {invariant} = new Contracts(true);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            protected _value: number = 0;
            get value() { return this._value; }
            inc() { this._value++; }
            dec() { this._value--; }
        }

        let foo = new Foo();

        expect(() => {
            foo.inc();
        }).not.toThrow();

        expect(() => {
            foo.dec();
        }).not.toThrow();

        expect(() => {
            foo.dec();
        }).toThrow(AssertionError);
    });

    test('Test method call in prodMode', () => {
        let {invariant} = new Contracts(false);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            protected _value: number = 0;
            get value() { return this._value; }
            inc() { this._value++; }
            dec() { this._value--; }
        }

        let foo = new Foo();

        expect(() => {
            foo.inc();
        }).not.toThrow();

        expect(() => {
            foo.dec();
        }).not.toThrow();

        expect(() => {
            foo.dec();
        }).not.toThrow();
    });
});

/**
 * Requirement 145
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/145
 */
describe('An invariant decorator must accept multiple [assertion, message] pairs', () => {
    test('invariant declaration in debug mode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Stack<any>>([
                [self => self.size >= 0 && self.size <= self.limit, 'The size of a stack must be between 0 and its limit'],
                [self => self.isEmpty() == (self.size == 0), 'An empty stack must have a size of 0'],
                [self => self.isFull() == (self.size == self.limit), 'A full stack must have a size that equals its limit']
            ])
            class Stack<T> {
                protected _implementation: T[] = [];

                constructor(readonly limit: number) {}

                isEmpty(): boolean {
                    return this._implementation.length == 0;
                }

                isFull(): boolean {
                    return this._implementation.length == this.limit;
                }

                pop(): T {
                    return this._implementation.pop()!;
                }

                push(item: T): void {
                    this._implementation.push(item);
                }

                get size(): number {
                    return this._implementation.length;
                }

                top(): T {
                    return this._implementation[this._implementation.length - 1];
                }
            }

            return Stack;
        }).not.toThrow();
    });
});

/**
 * Requirement 146
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/146
 */
describe('The invariant decorator has a debug mode and production mode', () => {
    test('init debug mode', () => {
        expect(new Contracts(true).invariant).toBeDefined();
    });

    test('init prod mode', () => {
        expect(new Contracts(false).invariant).toBeDefined();
    });
});

/**
 * Requirement 147
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/147
 */
describe('In debug mode the invariant decorator evaluates its assertions', () => {
    test('Construction throws in debugMode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).toThrow(AssertionError);
    });

    test('Method throws in debugMode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self.value === 37)
            class Foo {
                protected value: number = 37;

                dec() { this.value--; }
                inc() { this.value++; }
            }

            let foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }).toThrow(AssertionError);
    });

    test('Test getter/setter', () => {
        let {invariant} = new Contracts(true);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            protected _value: number = 0;
            get value() { return this._value; }
            set value(value: number) { this._value = value; }
        }

        let foo = new Foo();

        expect(() => {
            foo.value = 3;
        }).not.toThrow(AssertionError);

        expect(() => {
            foo.value = -1;
        }).toThrow(AssertionError);
    });
});

/**
 * Requirement 148
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/148
 */
describe('In production mode the invariant decorator does not evaluate its assertions', () => {
    let {invariant} = new Contracts(false);

    test('Construction does not throw', () => {
        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

    test('Method does not throw', () => {
        expect(() => {
            @invariant<Foo>(self => self.value === 42)
            class Foo {
                protected value: number = 0;

                dec() { this.value--; }
                inc() { this.value++; }
            }

            let foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }).not.toThrow();
    });
});

/**
 * Requirement 163
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/163
 */
describe('An invariant decorator must accept multiple assertions', () => {
    test('invariant declaration in debug mode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Stack<any>>(
                self => self.size >= 0 && self.size <= self.limit,
                self => self.isEmpty() == (self.size == 0),
                self => self.isFull() == (self.size == self.limit)
            )
            class Stack<T> {
                protected _implementation: T[] = [];

                constructor(readonly limit: number) {}

                isEmpty(): boolean {
                    return this._implementation.length == 0;
                }

                isFull(): boolean {
                    return this._implementation.length == this.limit;
                }

                pop(): T {
                    return this._implementation.pop()!;
                }

                push(item: T): void {
                    this._implementation.push(item);
                }

                get size(): number {
                    return this._implementation.length;
                }

                top(): T {
                    return this._implementation[this._implementation.length - 1];
                }
            }

            return Stack;
        }).not.toThrow();
    });
});

/**
 * Requirement 187
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/187
 */
describe('A subclass with its own invariants must enforce all ancestor invariants', () => {
    test('Debug Mode', () => {
        let {invariant} = new Contracts(true);

        expect(() => {
            @invariant(
                self => self instanceof Base,
                self => self != null
            )
            class Base {}

            @invariant(self => self instanceof Sub)
            class Sub extends Base {}

            return new Sub();
        }).not.toThrow();

        expect(() => {
            @invariant(self => self instanceof Array)
            class Base {}

            @invariant(self => self instanceof Sub)
            class Sub extends Base {}

            return new Sub();
        }).toThrow(AssertionError);

        expect(() => {
            @invariant(
                self => self instanceof Base,
                'I thought I was a Base!'
            )
            class Base {}

            @invariant(self => self instanceof Array)
            // @ts-ignore : Ignore unused error
            class Sub extends Base {}

            return new Base();
        }).not.toThrow();
    });
});

/**
 * Requirement 199
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/199
 */
describe('The invariant decorator supports use with no arguments', () => {
    let invariants = [
        new Contracts(true).invariant,
        new Contracts(false).invariant
    ];

    invariants.forEach(invariant => {
        expect(() => {
            @invariant()
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });
});