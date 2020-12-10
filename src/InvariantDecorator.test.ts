/*!
 * @license
 * Copyright (C) 2020 Michael L Haufe
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import Contracts from './';
import AssertionError from './AssertionError';

/**
 * https://github.com/final-hill/decorator-contracts/issues/28
 */
describe('The invariant decorator MUST be class decorator only', () => {
    const {invariant} = new Contracts(true);

    test('Define invariant', () => {
        expect(() => {
            @invariant(() => true)
            class Foo {}

            return Foo;
        }).not.toThrow();

        expect(() => {
            class Foo {
                // @ts-ignore : Raises a type error as expected.
                @invariant(() => true)
                baz(): void {}
            }

            return Foo;
        }).toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/29
 */
describe('There can be multiple invariant decorators assigned to a class', () => {
    const invariants = [
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
                // including falsy invariant but not evaluated
                @invariant<Foo>(self => self instanceof Foo)
                @invariant<Foo>(self => self instanceof Array)
                class Foo extends Object {}

                return Foo;
            }).not.toThrow();
        });
    });

    test('Constructing with multiple invariants in debug mode', () => {
        const {invariant} = new Contracts(true);

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
        const {invariant} = new Contracts(false);

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
 * https://github.com/final-hill/decorator-contracts/issues/30
 */
describe('The subclasses of an invariant decorated class must obey the invariant', () => {
    test('Test subclassing in debug mode', () => {
        const {invariant, override} = new Contracts(true);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            #value = 0;

            get value(): number { return this.#value; }
            set value(value: number) { this.#value = value; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        class Bar extends Foo {}

        expect(() => {
            const bar = new Bar();
            bar.inc();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.dec();
        }).toThrow(AssertionError);

        expect(() => {
            const bar = new Bar();
            bar.value = 3;
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();

            return bar.value == 0;
        }).not.toThrow(AssertionError);

        expect(() => {
            const bar = new Bar();
            bar.value = -1;
        }).toThrow(AssertionError);

        // overriding members
        class Baz extends Foo {
            @override
            get value(): number { return super.value; }
            set value(value: number) { super.value = value; }

            @override
            inc(): void { super.value++; }
            @override
            dec(): void { super.value--; }
        }

        expect(() => {
            const baz = new Baz();
            baz.inc();
            baz.dec();
        }).not.toThrow();

        expect(() => {
            const baz = new Baz();
            baz.dec();
        }).toThrow(AssertionError);

        expect(() => {
            const baz = new Baz();
            baz.value = 3;
        }).not.toThrow();

        expect(() => {
            const baz = new Baz();

            return baz.value == 0;
        }).not.toThrow(AssertionError);

        expect(() => {
            const baz = new Baz();
            baz.value = -1;
        }).toThrow(AssertionError);
    });

    test('Test subclassing in prod mode', () => {
        const {invariant} = new Contracts(false);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            #value = 0;
            get value(): number { return this.#value; }
            set value(value: number) { this.#value = value; }

            inc(): void { this.#value++; }
            dec(): void { this.#value--; }
        }

        class Bar extends Foo {}

        expect(() => {
            const bar = new Bar();
            bar.inc();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.dec();
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.value = 3;
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();

            return bar.value == 0;
        }).not.toThrow(AssertionError);

        expect(() => {
            const bar = new Bar();
            bar.value = -1;
        }).not.toThrow(AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/31
 */
describe('A truthy invariant does not throw an exception when evaluated', () => {
    const invariants = [
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
                    #value = 0;
                    get value(): number { return this.#value; }
                    set value(v) { this.#value = v; }

                    dec(): void { this.value--; }
                    inc(): void { this.value++; }
                }

                const foo = new Foo();
                foo.inc();
                foo.dec();

                return foo;
            }).not.toThrow();
        });
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/32
 */
describe('A falsy invariant throws an exception when evaluated', () => {

    test('Construction throws in checkMode', () => {
        const {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).toThrow(AssertionError);
    });

    test('Construction does not throw in production mode', () => {
        const {invariant} = new Contracts(false);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

    test('Method throws in checkMode', () => {
        const {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self.value === 37)
            class Foo {
                #value = 37;
                get value(): number { return this.#value; }
                set value(v) { this.#value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }).toThrow(AssertionError);
    });

    test('Method does not throw in production mode', () => {
        const {invariant} = new Contracts(false);

        expect(() => {
            @invariant<Foo>(self => self.value === 37)
            class Foo {
                #value = 37;
                get value(): number { return this.#value; }
                set value(v) { this.#value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/33
 */
describe('An invariant is evaluated after it\'s associated class is constructed', () => {
    test('truthy construction does not throw in debug and prod mode', () => {
        const invariants = [
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
        const {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).toThrow();
    });

    test('falsy construction does not throw in prod mode', () => {
        const {invariant} = new Contracts(false);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

});

/**
 * https://github.com/final-hill/decorator-contracts/issues/34
 */
describe('An invariant is evaluated before and after every method call on the associated class', () => {
    test('Test method call in checkMode', () => {
        const {invariant} = new Contracts(true);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            #value = 0;
            get value(): number { return this.#value; }
            set value(v) { this.#value = v; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        const foo = new Foo();

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
        const {invariant} = new Contracts(false);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            #value = 0;
            get value(): number { return this.#value; }
            set value(v) { this.#value = v; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        const foo = new Foo();

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
 * https://github.com/final-hill/decorator-contracts/issues/37
 */
describe('The invariant decorator has a checked mode and unchecked mode', () => {
    test('init debug mode', () => {
        expect(new Contracts(true).invariant).toBeDefined();
    });

    test('init prod mode', () => {
        expect(new Contracts(false).invariant).toBeDefined();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/38
 */
describe('In checked mode the invariant decorator evaluates its assertions', () => {
    test('Construction throws in checkMode', () => {
        const {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self instanceof Array)
            class Foo {}

            return new Foo();
        }).toThrow(AssertionError);
    });

    test('Method throws in checkMode', () => {
        const {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Foo>(self => self.value === 37)
            class Foo {
                #value = 37;
                get value(): number { return this.#value; }
                set value(v) { this.#value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }).toThrow(AssertionError);
    });

    test('Test getter/setter', () => {
        const {invariant} = new Contracts(true);

        @invariant<Foo>(self => self.value >= 0)
        class Foo {
            #value = 0;
            get value(): number { return this.#value; }
            set value(value: number) { this.#value = value; }
        }

        const foo = new Foo();

        expect(() => {
            foo.value = 3;
        }).not.toThrow(AssertionError);

        expect(() => {
            foo.value = -1;
        }).toThrow(AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/39
 */
describe('In checked mode the invariant decorator does not evaluate its assertions', () => {
    const {invariant} = new Contracts(false);

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
                #value = 0;
                get value(): number { return this.#value; }
                set value(v) { this.#value = v; }

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/40
 */
describe('A subclass with its own invariants must enforce all ancestor invariants', () => {
    test('Debug Mode', () => {
        const {invariant} = new Contracts(true);

        expect(() => {
            @invariant<Base>(self => self instanceof Base)
            @invariant<Base>(self => self != null)
            class Base {}

            @invariant<Sub>(self => self instanceof Sub)
            class Sub extends Base {}

            return new Sub();
        }).not.toThrow();

        expect(() => {
            @invariant<Base>(self => self instanceof Array)
            class Base {}

            @invariant<Sub>(self => self instanceof Sub)
            class Sub extends Base {}

            return new Sub();
        }).toThrow(AssertionError);

        expect(() => {
            @invariant<Base>(self => self instanceof Base)
            class Base {}

            @invariant<Base>(self => self instanceof Array)
            // @ts-ignore : Ignore unused error
            class Sub extends Base {}

            return new Base();
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/41
 */
describe('The invariant decorator supports use with no arguments', () => {
    const invariants = [
        new Contracts(true).invariant,
        new Contracts(false).invariant
    ];

    invariants.forEach(invariant => {
        expect(() => {
            @invariant
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });
});