/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, checkedMode, Contract, Contracted, extend, invariant } from '../index.mjs';
import { Messages } from '../Messages.mjs';

// https://github.com/final-hill/decorator-contracts/issues/30
describe('The subclasses of a contracted class must obey the invariants', () => {
    const fooContract: Contract<Foo> = new Contract<Foo>({
        [checkedMode]: true,
        [invariant]: self => self.value >= 0
    });

    @Contracted(fooContract)
    class Foo {
        accessor value = 0;

        inc(): void { this.value++; }
        dec(): void { this.value--; }
    }

    class Bar extends Foo { }
    test('Test subclassing in debug mode', () => {
        nodeAssert.doesNotThrow(() => {
            const bar = new Bar();
            bar.inc();
            bar.dec();
        });

        nodeAssert.throws(() => {
            const bar = new Bar();
            bar.dec();
        }, AssertionError);

        nodeAssert.doesNotThrow(() => {
            const bar = new Bar();
            bar.value = 3;
        });

        nodeAssert.doesNotThrow(() => {
            const bar = new Bar();

            return bar.value == 0;
        });

        nodeAssert.throws(() => {
            const bar = new Bar();
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
            const baz = new Baz();
            baz.inc();
            baz.dec();
        });

        nodeAssert.throws(() => {
            const baz = new Baz();
            baz.dec();
        }, AssertionError);

        nodeAssert.doesNotThrow(() => {
            const baz = new Baz();
            baz.value = 3;
        });

        nodeAssert.doesNotThrow(() => {
            const baz = new Baz();

            return baz.value == 0;
        });

        nodeAssert.throws(() => {
            const baz = new Baz();
            baz.value = -1;
        }, AssertionError);
    });

    test('Test subclassing in prod mode', () => {
        const fooContract: Contract<Foo> = new Contract<Foo>({
            [checkedMode]: false,
            [invariant]: self => self.value >= 0
        });

        @Contracted(fooContract)
        class Foo {
            accessor value = 0;

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        class Bar extends Foo { }

        nodeAssert.doesNotThrow(() => {
            const bar = new Bar();
            bar.inc();
            bar.dec();
        });

        nodeAssert.doesNotThrow(() => {
            const bar = new Bar();
            bar.dec();
        });

        nodeAssert.doesNotThrow(() => {
            const bar = new Bar();
            bar.value = 3;
        });

        nodeAssert.doesNotThrow(() => {
            const bar = new Bar();

            return bar.value == 0;
        });

        nodeAssert.doesNotThrow(() => {
            const bar = new Bar();
            bar.value = -1;
        });
    });

    test('Subcontract with private field', () => {
        const baseContract = new Contract<Base>({});
        @Contracted(baseContract)
        class Base { }

        const subContract = new Contract<Sub>({
            [extend]: baseContract,
            [invariant](self) { return self.value >= 0; }
        });

        @Contracted(subContract)
        class Sub extends Base {
            #value = 0;
            get value() { return this.#value; }
        }

        nodeAssert.doesNotThrow(() =>
            new Sub()
        );
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/31
 */
describe('A truthy invariant does not throw an exception when evaluated', () => {
    test('Construction does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const enabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: true,
                [invariant]: self => self instanceof Foo
            });
            @Contracted(enabledContract)
            class Foo { }

            return new Foo();
        });
        nodeAssert.doesNotThrow(() => {
            const disabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self instanceof Foo
            });
            @Contracted(disabledContract)
            class Foo { }

            return new Foo();
        });
    });

    test('Method does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const enabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: true,
                [invariant]: self => self.value >= 0
            });

            @Contracted(enabledContract)
            class Foo {
                accessor value = 0;

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        });

        nodeAssert.doesNotThrow(() => {
            const disabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self.value >= 0
            });

            @Contracted(disabledContract)
            class Foo {
                accessor value = 0;

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        });
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/32
 */
describe('A falsy invariant throws an exception when evaluated', () => {
    test('Construction throws in checkMode', () => {
        nodeAssert.throws(() => {
            const badContract = new Contract<Foo>({
                [invariant]: self => self instanceof Set
            });

            @Contracted(badContract)
            class Foo { }

            return new Foo();
        }, AssertionError);
    });

    test('Construction does not throw in unchecked mode', () => {
        nodeAssert.doesNotThrow(() => {
            const badContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self instanceof Map
            });

            @Contracted(badContract)
            class Foo { }

            return new Foo();
        });
    });

    test('Method throws in checkMode', () => {
        nodeAssert.throws(() => {
            const fooContract: Contract<Foo> = new Contract<Foo>({
                [invariant]: self => self.value === 37
            });

            @Contracted(fooContract)
            class Foo {
                accessor value = 37;

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }, AssertionError);
    });

    test('Method does not throw in unchecked mode', () => {
        nodeAssert.doesNotThrow(() => {
            const fooContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self.value === 37
            });

            @Contracted(fooContract)
            class Foo {
                accessor value = 37;

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        });
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/33
 */
describe('Invariants are evaluated after the associated class is constructed', () => {
    test('truthy construction does not throw in checked and unchecked mode', () => {
        nodeAssert.doesNotThrow(() => {
            const enabledContract: Contract<Foo> = new Contract<Foo>({
                [invariant]: self => self instanceof Foo
            });

            @Contracted(enabledContract)
            class Foo { }

            return new Foo();
        });

        nodeAssert.doesNotThrow(() => {
            const disabledContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self instanceof Foo
            });

            @Contracted(disabledContract)
            class Foo { }

            return new Foo();
        });
    });

    test('falsy construction throws in checked mode', () => {
        nodeAssert.throws(() => {
            const fooContract: Contract<Foo> = new Contract<Foo>({
                [invariant]: self => self instanceof Array
            });

            @Contracted(fooContract)
            class Foo { }

            return new Foo();
        });
    });

    test('falsy construction does not throw in unchecked mode', () => {
        nodeAssert.doesNotThrow(() => {
            const fooContract: Contract<Foo> = new Contract<Foo>({
                [checkedMode]: false,
                [invariant]: self => self instanceof Error
            });

            @Contracted(fooContract)
            class Foo { }

            return new Foo();
        });
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
            accessor value = 0;

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        const foo = new Foo();

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
        const fooContract: Contract<Foo> = new Contract<Foo>({
            [checkedMode]: false,
            [invariant]: self => self.value >= 0
        });

        @Contracted(fooContract)
        class Foo {
            accessor value = 0;

            inc(): void { this.value++; }
            dec(): void { this.value--; }
        }

        const foo = new Foo();

        nodeAssert.doesNotThrow(() => {
            foo.inc();
        });

        nodeAssert.doesNotThrow(() => {
            foo.dec();
        });

        nodeAssert.doesNotThrow(() => {
            foo.dec();
        });
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/35
 */
describe('Public properties must be forbidden', () => {
    test('Class without public properties', () => {
        nodeAssert.doesNotThrow(() => {
            @Contracted()
            class Foo {
                accessor value = 10;
            }

            return new Foo();
        });

        nodeAssert.throws(() => {
            @Contracted()
            class Foo {
                val = 10;
                get value() { return this.val; }
                set value(v) { this.val = v; }
            }

            return new Foo();
        }, Messages.MsgNoProperties);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/38
 */
describe('In checked mode the invariant is evaluated', () => {
    test('Construction throws in checkMode', () => {
        nodeAssert.throws(() => {
            const fooContract = new Contract<Foo>({
                [invariant](self) { return self instanceof Array; }
            });

            @Contracted(fooContract)
            class Foo { }

            return new Foo();
        }, AssertionError);
    });

    test('Method throws in checkMode', () => {
        nodeAssert.throws(() => {
            const fooContract = new Contract<Foo>({
                [invariant](self) { return self.value === 37; }
            });

            @Contracted(fooContract)
            class Foo {
                accessor value = 37;

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        }, AssertionError);
    });

    test('Test getter/setter', () => {
        const fooContract = new Contract<Foo>({
            [invariant](self) { return self.value >= 0; }
        });
        @Contracted(fooContract)
        class Foo {
            accessor value = 0;
        }

        const foo = new Foo();

        nodeAssert.doesNotThrow(() => {
            foo.value = 3;
        }, AssertionError);

        nodeAssert.throws(() => {
            foo.value = -1;
        }, AssertionError);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/39
 */
describe('In unchecked mode the invariant is not evaluated', () => {
    test('Construction does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const fooContract = new Contract<Foo>({
                [checkedMode]: false,
                [invariant](self) {
                    return self instanceof Array;
                }
            });
            @Contracted(fooContract)
            class Foo { }

            return new Foo();
        });
    });

    test('Method does not throw', () => {
        nodeAssert.doesNotThrow(() => {
            const fooContract = new Contract<Foo>({
                [checkedMode]: false,
                [invariant](self) {
                    return self.value === 42;
                }
            });

            @Contracted(fooContract)
            class Foo {
                accessor value = 0;

                dec(): void { this.value--; }
                inc(): void { this.value++; }
            }

            const foo = new Foo();
            foo.inc();
            foo.dec();

            return foo;
        });
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/40
 */
describe('A subclass with its own invariants must enforce all ancestor invariants', () => {
    test('Checked Mode', () => {
        nodeAssert.doesNotThrow(() => {
            const baseContract = new Contract<Base>({
                [invariant]: self => self instanceof Base && self != null
            }),
                subContract = new Contract<Sub>({
                    [extend]: baseContract,
                    [invariant]: self => self instanceof Sub
                });

            @Contracted(baseContract)
            class Base { }

            @Contracted(subContract)
            class Sub extends Base { }

            return new Sub();
        });

        nodeAssert.throws(() => {
            const baseContract = new Contract<Base>({
                [invariant]: self => self instanceof Array
            }),
                subContract = new Contract<Sub>({
                    [extend]: baseContract,
                    [invariant]: self => self instanceof Sub
                });

            @Contracted(baseContract)
            class Base { }

            @Contracted(subContract)
            class Sub extends Base { }

            return new Sub();
        }, AssertionError);

        nodeAssert.doesNotThrow(() => {
            const baseContract = new Contract<Base>({
                [invariant]: self => self instanceof Base
            }),
                subContract = new Contract<Sub>({
                    [extend]: baseContract,
                    [invariant]: self => self instanceof Array
                });

            @Contracted(baseContract)
            class Base { }

            @Contracted(subContract)
            class Sub extends Base { }

            return new Base();
        });
    });

    test('Unchecked mode both contracts', () => {
        nodeAssert.doesNotThrow(() => {
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
            class Base { }

            @Contracted(subContract)
            class Sub extends Base { }

            return new Sub();
        });
    });

    test('Unchecked mode base contract', () => {
        nodeAssert.doesNotThrow(() => {
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
            class Base { }

            @Contracted(subContract)
            class Sub extends Base { }

            return new Sub();
        });
    });

    test('Unchecked mode sub contract', () => {
        nodeAssert.throws(() => {
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
            class Base { }

            @Contracted(subContract)
            class Sub extends Base { }

            return new Sub();
        }, AssertionError);
        nodeAssert.doesNotThrow(() => {
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
            class Base { }

            @Contracted(subContract)
            class Sub extends Base { }

            return new Sub();
        });
    });
});

// https://github.com/final-hill/decorator-contracts/issues/217
describe('Third-party features applied to a contracted class are subject to its invariant', () => {
    const fooContract: Contract<Foo> = new Contract<Foo>({
        [checkedMode]: true,
        [invariant]: self => self.value >= 0
    });

    @Contracted(fooContract)
    class Foo {
        accessor value = 0;

        inc(): void { this.value++; }
        dec(): void { this.value--; }
    }

    class Bar {
        accessor value = 0;

        inc(): void { this.value++; }
        dec(): void { this.value--; }
    }

    test('okay', () => {
        const foo = new Foo(),
            bar = new Bar();
        bar.inc.apply(foo);

        nodeAssert.strictEqual(foo.value, 1);
    });

    test('failure', () => {
        nodeAssert.throws(() => {
            const foo = new Foo(),
                bar = new Bar();
            bar.dec.apply(foo);
        }, /^Invariant violated/);
    });
});

// https://github.com/final-hill/decorator-contracts/issues/218
describe('Contracted features can only be applied to objects of the same instance', () => {
    const fooContract: Contract<Foo> = new Contract<Foo>({
        [checkedMode]: true,
        [invariant]: self => self.value >= 0
    });

    @Contracted(fooContract)
    class Foo {
        accessor value = 0;

        inc(): void { this.value++; }
    }

    class Bar {
        accessor value = 0;

        inc(): void { this.value++; }
    }

    const foo = new Foo(),
        bar = new Bar();

    test('same instance okay', () => {
        foo.inc.apply(foo);
        nodeAssert.strictEqual(foo.value, 1);
    });

    test('different instance error', () => {
        nodeAssert.throws(() => {
            foo.inc.apply(bar);
        }, Messages.MsgInvalidContext);
    });
});