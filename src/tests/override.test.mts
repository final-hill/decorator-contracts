/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Contracted, override } from '../index.mjs';
import { Messages } from '../Messages.mjs';

/**
 * https://github.com/final-hill/decorator-contracts/issues/44
 */
describe('The override decorator is a non-static member decorator only', () => {
    test('class decorator throws', () => {
        expect(() => {
            // @ts-ignore: Ignoring type error for JS test
            @override
            class Base { }

            return Base;
        }).toThrow();
    });

    test('static method decorator throws', () => {
        expect(() => {
            class Base {
                @override
                static method(): void { }
            }

            return Base;
        }).toThrow(Messages.MsgNoStatic);
    });

    test('instance method decorator does not throw', () => {
        expect(() => {
            @Contracted()
            class Base {
                method(): void { }
            }

            class Sub extends Base {
                @override
                override method(): void { }
            }

            return Sub;
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/46
 */
describe('Using @override on a class member with no ancestor member is an error', () => {
    test('base class with @override decorator', () => {
        expect(() => {
            @Contracted()
            class Base {
                @override
                method(): void { }
            }

            return Base;
        }).toThrow(`${Messages.MsgNoMatchingFeature} 'Base.prototype.method'`);
    });

    test('subclass with @override decorator', () => {
        expect(() => {
            @Contracted()
            class Base { }

            class Sub extends Base {
                @override
                method(): void { }
            }

            return Sub;
        }).toThrow(Messages.MsgNoMatchingFeature);
    });

    test('subclass with method overriding non-method', () => {
        expect(() => {
            @Contracted()
            class Base {
                method = 'foo';
            }

            class Sub extends Base {
                @override
                // @ts-ignore: Ignoring type error for JS check
                method(): void { }
            }

            return Sub;
        }).toThrow(Messages.MsgNoMatchingFeature);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/47
 */
describe('using @override on a method with an ancestor with a different parameter count is an error', () => {
    test('bad override', () => {
        expect(() => {
            @Contracted()
            class Base {
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            class Sub extends Base {
                @override
                override method(a: string): string {
                    return a;
                }
            }

            return Sub;
        }).toThrow(Messages.MsgInvalidArgLength);
    });

    test('bad override 2', () => {
        expect(() => {
            @Contracted()
            class Base {
                method(a: string): string {
                    return `${a}`;
                }
            }

            class Sub extends Base {
                @override
                // @ts-ignore: type error for JS test
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            return Sub;
        }).toThrow(Messages.MsgInvalidArgLength);
    });

    test('good override', () => {
        expect(() => {
            @Contracted()
            class Base {
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            class Sub extends Base {
                @override
                override method(a: string, b: string): string {
                    return super.method(a, b);
                }
            }

            return Sub;
        }).not.toThrow();
    });

});

/**
 * https://github.com/final-hill/decorator-contracts/issues/48
 */
describe('A subclass with an overriding member missing @override is an error', () => {
    test('@override defined', () => {
        expect(() => {
            @Contracted()
            class Base {
                get foo(): number { return 3; }

                method(): void { }
            }

            class Sub extends Base {
                @override
                override get foo(): number { return 4; }

                @override
                override method(): void { }
            }

            return new Sub();
        }).not.toThrow();
    });

    test('@override missing', () => {
        expect(() => {
            @Contracted()
            class Base {
                method(): void { }
            }

            class Sub extends Base {
                override method(): void { }
            }

            return new Sub();
        }).toThrow('@override decorator missing on Sub.prototype.method');

        expect(() => {
            @Contracted()
            class Base {
                get prop(): number { return 3; }
            }

            class Sub extends Base {
                override get prop(): number { return 5; }
            }

            return new Sub();
        }).toThrow('@override decorator missing on Sub.prototype.prop');
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/54
 */
describe('Only a single @override can be assigned to a member per class', () => {
    test('duplicate @override', () => {
        expect(() => {
            @Contracted()
            class Base {
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            class Sub extends Base {
                @override
                @override
                override method(a: string, b: string): string {
                    return super.method(a, b);
                }
            }

            return Sub;
        }).toThrow(Messages.MsgDuplicateOverride);
    });

    test('Three level @override', () => {
        expect(() => {
            @Contracted()
            class Base {
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            class Sub extends Base {
                @override
                override method(a: string, b: string): string {
                    return super.method(a, b);
                }
            }

            class SubSub extends Sub {
                @override
                override method(a: string, b: string): string {
                    return super.method(a, b);
                }
            }

            return SubSub;
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/50
 */
describe('Accessors must support @override', () => {
    test('instance accessor decorator does not throw', () => {
        expect(() => {
            @Contracted()
            class Base {
                #value = 0;
                get value(): number { return this.#value; }
                set value(x: number) { this.#value = x; }
            }

            class Sub extends Base {
                @override
                override set value(x: number) {
                    super.value = x;
                }
            }

            return Sub;
        }).not.toThrow();
    });

    test('bad accessor decorator throws', () => {
        expect(() => {
            class Base {
                #value = 0;
                get value(): number { return this.#value; }
                set value(x: number) { this.#value = x; }
            }

            class Sub extends Base {
                @override
                set foo(x: number) {
                    super.value = x;
                }
            }

            return Sub;
        }).toThrow();
    });
});

// https://github.com/final-hill/decorator-contracts/issues/170
describe('The \'override\' decorator must have a Contracted class in it\'s ancestry', () => {
    test('Valid declaration', () => {
        @Contracted()
        class Base {
            method(value: number): number { return value; }
        }

        class Okay extends Base {
            @override
            override method(value: number): number { return value; }
        }

        const okay = new Okay();

        expect(okay.method(15)).toBe(15);
    });

    test('Invalid declaration', () => {
        expect(() => {
            class BadBase {
                method(value: number): number { return value; }
            }

            class Fail extends BadBase {
                @override
                override method(value: number): number { return value; }
            }

            return new Fail().method(7);
        }).toThrow(Messages.MsgNotContracted);
    });

    test('override on base class', () => {
        expect(() => {
            @Contracted()
            class Base {
                toString() { }
            }

            return new Base().toString();
        }).toThrow('@override decorator missing on Base.prototype.toString');

        expect(() => {
            @Contracted()
            class Base {
                @override
                toString() { }
            }

            return new Base().toString();
        }).not.toThrow();
    });
});

describe('Features named with a symbol must support `@override`', () => {
    test('Invalid declaration', () => {
        expect(() => {
            const method = Symbol('method');
            class BadBase {
                [method](value: number): number { return value; }
            }

            class Fail extends BadBase {
                @override
                override[method](value: number): number { return value; }
            }

            return new Fail()[method](7);
        }).toThrow(Messages.MsgNotContracted);
    });
    test('Valid declaration', () => {
        const method = Symbol('method');
        @Contracted()
        class Base {
            [method](value: number): number { return value; }
        }

        class Okay extends Base {
            @override
            override[method](value: number): number { return value; }
        }

        const okay = new Okay();

        expect(okay[method](15)).toBe(15);
    });
});