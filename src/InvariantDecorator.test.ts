/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
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

//TODO
describe('@invariant debug mode', () => {
    let {invariant} = new Contracts(true);

    test('Construction does not throw', () => {
        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

    test('Falsey invariant throws on construction', () => {
        @invariant(self => self instanceof Array)
        class Foo {}

        expect(() => {
            return new Foo();
        }).toThrow(AssertionError);
    });

    test('Test getter/setter', () => {
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

    test('Test method call', () => {
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

    test('Test subclassing', () => {
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
    });
 });

describe('@invariant prod mode', () => {
    let {invariant} = new Contracts(false);

    test('Define invariant', () => {
        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            class Foo {}

            return Foo;
        }).not.toThrow();
    });

    test('Construction does not throw', () => {
        expect(() => {
            @invariant<Foo>(self => self instanceof Foo)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

    test('Falsey invariant does not throw on construction', () => {
        @invariant(self => self instanceof Array)
        class Foo {}

        expect(() => {
            return new Foo();
        }).not.toThrow(AssertionError);
    });

    test('Test getter/setter', () => {
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
        }).not.toThrow(AssertionError);
    });

    test('Test method call', () => {
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
        }).not.toThrow(AssertionError);
    });

    test('Test subclassing', () => {
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
        }).not.toThrow(AssertionError);

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