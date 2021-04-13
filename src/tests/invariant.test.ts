/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { AssertionError, checkedMode, Contract, Contracted, extend, invariant, override } from '../';
import { MSG_NO_PROPERTIES } from '../Messages';

// https://github.com/final-hill/decorator-contracts/issues/30
describe('The subclasses of a contracted class must obey the invariants', () => {
    const fooContract: Contract<Foo> = new Contract<Foo>({
        [checkedMode]: true,
        [invariant]: self => self.value >= 0
    });

    @Contracted(fooContract)
    class Foo {
        #value = 0;

        get value(): number { return this.#value; }
        set value(value: number) { this.#value = value; }

        inc(): void { this.value++; }
        dec(): void { this.value--; }
    }

    class Bar extends Foo { }
    test('Test subclassing in debug mode', () => {
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
        }).not.toThrow();

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
        }).not.toThrow();

        expect(() => {
            const baz = new Baz();
            baz.value = -1;
        }).toThrow(AssertionError);
    });

    test('Test subclassing in prod mode', () => {
        const fooContract: Contract<Foo> = new Contract<Foo>({
            [checkedMode]: false,
            [invariant]: self => self.value >= 0
        });

        @Contracted(fooContract)
        class Foo {
            #value = 0;

            get value(): number { return this.#value; }
            set value(value: number) { this.#value = value; }

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        class Bar extends Foo { }

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
        }).not.toThrow();

        expect(() => {
            const bar = new Bar();
            bar.value = -1;
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/31
 */
describe('A truthy invariant does not throw an exception when evaluated', () => {
    test('Construction does not throw', () => {
        expect(() => {
            const enabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: true,
                [invariant]: self => self instanceof Foo
            });
            @Contracted(enabledContract)
            class Foo { }

            return new Foo();
        }).not.toThrow();
        expect(() => {
            const disabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self instanceof Foo
            });
            @Contracted(disabledContract)
            class Foo { }

            return new Foo();
        }).not.toThrow();
    });

    test('Method does not throw', () => {
        expect(() => {
            const enabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: true,
                [invariant]: self => self.value >= 0
            });

            @Contracted(enabledContract)
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

        expect(() => {
            const disabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self.value >= 0
            });

            @Contracted(disabledContract)
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
 * https://github.com/final-hill/decorator-contracts/issues/32
 */
describe('A falsy invariant throws an exception when evaluated', () => {
    test('Construction throws in checkMode', () => {
        expect(() => {
            const badContract = new Contract<Foo>({
                [invariant]: self => self instanceof Set
            });

            @Contracted(badContract)
            class Foo { }

            return new Foo();
        }).toThrow(AssertionError);
    });

    test('Construction does not throw in unchecked mode', () => {
        expect(() => {
            const badContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self instanceof Map
            });

            @Contracted(badContract)
            class Foo { }

            return new Foo();
        }).not.toThrow();
    });

    test('Method throws in checkMode', () => {
        expect(() => {
            const fooContract: Contract<Foo> = new Contract<Foo>({
                [invariant]: self => self.value === 37
            });

            @Contracted(fooContract)
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

    test('Method does not throw in unchecked mode', () => {
        expect(() => {
            const fooContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self.value === 37
            });

            @Contracted(fooContract)
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
describe('Invariants are evaluated after the associated class is constructed', () => {
    test('truthy construction does not throw in checked and unchecked mode', () => {
        expect(() => {
            const enabledContract: Contract<Foo> = new Contract<Foo>({
                [invariant]: self => self instanceof Foo
            });

            @Contracted(enabledContract)
            class Foo { }

            return new Foo();
        }).not.toThrow();

        expect(() => {
            const disabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self instanceof Foo
            });

            @Contracted(disabledContract)
            class Foo { }

            return new Foo();
        }).not.toThrow();
    });

    test('falsy construction throws in checked mode', () => {
        expect(() => {
            const fooContract: Contract<Foo> = new Contract<Foo>({
                [invariant]: self => self instanceof Array
            });

            @Contracted(fooContract)
            class Foo { }

            return new Foo();
        }).toThrow();
    });

    test('falsy construction does not throw in unchecked mode', () => {
        expect(() => {
            const fooContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self instanceof Error
            });


            @Contracted(fooContract)
            class Foo { }

            return new Foo();
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/34
 */
describe('An invariant is evaluated before and after every method call on the associated class', () => {
    test('Test method call in checked kMode', () => {
        const fooContract: Contract<Foo> = new Contract<Foo>({
            [invariant]: self => self.value >= 0
        });

        @Contracted(fooContract)
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

    test('Test method call in unchecked mode', () => {
        const fooContract: Contract<Foo> = new Contract<Foo>({
            [checkedMode]: false,
            [invariant]: self => self.value >= 0
        });

        @Contracted(fooContract)
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
 * https://github.com/final-hill/decorator-contracts/issues/35
 */
describe('Public properties must be forbidden', () => {
    test('Class without public properties', () => {
        expect(() => {
            @Contracted()
            class Foo {
                #value = 10;
                get value(){ return this.#value; }
                set value(v){ this.#value = v; }
            }

            return new Foo();
        }).not.toThrow();

        expect(() => {
            @Contracted()
            class Foo {
                val = 10;
                get value(){ return this.val; }
                set value(v){ this.val = v; }
            }

            return new Foo();
        }).toThrow(MSG_NO_PROPERTIES);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/38
 */
describe('In checked mode the invariant is evaluated', () => {
    test('Construction throws in checkMode', () => {
        expect(() => {
            const fooContract = new Contract<Foo>({
                [invariant](self) { return self instanceof Array; }
            });

            @Contracted(fooContract)
            class Foo {}

            return new Foo();
        }).toThrow(AssertionError);
    });

    test('Method throws in checkMode', () => {
        expect(() => {
            const fooContract = new Contract<Foo>({
                [invariant](self) { return self.value === 37; }
            });

            @Contracted(fooContract)
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
        const fooContract = new Contract<Foo>({
            [invariant](self){ return self.value >= 0;}
        });
        @Contracted(fooContract)
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
describe('In unchecked mode the invariant is not evaluated', () => {
    test('Construction does not throw', () => {
        expect(() => {
            const fooContract = new Contract<Foo>({
                [checkedMode]: false,
                [invariant](self){
                    return self instanceof Array;
                }
            });
            @Contracted(fooContract)
            class Foo {}

            return new Foo();
        }).not.toThrow();
    });

    test('Method does not throw', () => {
        expect(() => {
            const fooContract = new Contract<Foo>({
                [checkedMode]: false,
                [invariant](self){
                    return self.value === 42;
                }
            });

            @Contracted(fooContract)
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
describe('A subclass with its own invariants must enforce all ancestor invariants',() => {
    test('Checked Mode', () => {
        expect(() => {
            const baseContract = new Contract<Base>({
                [invariant]: self => self instanceof Base && self != null
            }),
            subContract = new Contract<Sub>({
                [extend]: baseContract,
                [invariant]: self => self instanceof Sub
            });

            @Contracted(baseContract)
            class Base {}

            @Contracted(subContract)
            class Sub extends Base {}

            return new Sub();
        }).not.toThrow();

        expect(() => {
            const baseContract = new Contract<Base>({
                [invariant]: self => self instanceof Array
            }),
            subContract = new Contract<Sub>({
                [extend]: baseContract,
                [invariant]: self => self instanceof Sub
            });

            @Contracted(baseContract)
            class Base {}

            @Contracted(subContract)
            class Sub extends Base {}

            return new Sub();
        }).toThrow(AssertionError);

        expect(() => {
            const baseContract = new Contract<Base>({
                [invariant]: self => self instanceof Base
            }),
            subContract = new Contract<Sub>({
                [extend]: baseContract,
                [invariant]: self => self instanceof Array
            });

            @Contracted(baseContract)
            class Base {}

            @Contracted(subContract)
            class Sub extends Base {}

            return new Base();
        }).not.toThrow();
    });

    test('Unchecked mode both contracts', () => {
        expect(() => {
            const baseContract = new Contract<Base>({
                [checkedMode]: false,
                [invariant]: () => false
            }),
            subContract = new Contract<Sub>({
                [checkedMode]: false,
                [extend]: baseContract,
                [invariant]: () => false
            });

            @Contracted(baseContract)
            class Base {}

            @Contracted(subContract)
            class Sub extends Base {}

            return new Sub();
        }).not.toThrow(AssertionError);
    });

    test('Unchecked mode base contract', () => {
        expect(() => {
            const baseContract = new Contract<Base>({
                [checkedMode]: false,
                [invariant]: () => false
            }),
            subContract = new Contract<Sub>({
                [checkedMode]: true,
                [extend]: baseContract,
                [invariant]: () => true
            });

            @Contracted(baseContract)
            class Base {}

            @Contracted(subContract)
            class Sub extends Base {}

            return new Sub();
        }).not.toThrow(AssertionError);
    });

    test('Unchecked mode sub contract', () => {
        expect(() => {
            const baseContract = new Contract<Base>({
                [checkedMode]: true,
                [invariant]: () => false
            }),
            subContract = new Contract<Sub>({
                [checkedMode]: false,
                [extend]: baseContract,
                [invariant]: () => true
            });

            @Contracted(baseContract)
            class Base {}

            @Contracted(subContract)
            class Sub extends Base {}

            return new Sub();
        }).toThrow(AssertionError);
        expect(() => {
            const baseContract = new Contract<Base>({
                [checkedMode]: true,
                [invariant]: () => true
            }),
            subContract = new Contract<Sub>({
                [checkedMode]: false,
                [extend]: baseContract,
                [invariant]: () => false
            });

            @Contracted(baseContract)
            class Base {}

            @Contracted(subContract)
            class Sub extends Base {}

            return new Sub();
        }).not.toThrow(AssertionError);
    });
});