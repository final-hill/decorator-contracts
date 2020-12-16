/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Contracted, override } from './';
import { MSG_NO_MATCHING_FEATURE, MSG_INVALID_ARG_LENGTH, MSG_DUPLICATE_OVERRIDE, MSG_NO_STATIC, MSG_NOT_CONTRACTED } from './Messages';

/**
 * https://github.com/final-hill/decorator-contracts/issues/44
 */
describe('The override decorator is a non-static member decorator only', () => {
    test('class decorator throws', () => {
        expect(() => {
            // @ts-ignore: Ignoring type error for JS test
            @override
            class Base {}

            return Base;
        }).toThrow();
    });

    test('static method decorator throws', () => {
        expect(() => {
            class Base {
                @override
                static method(): void {}
            }

            return Base;
        }).toThrow(MSG_NO_STATIC);
    });

    test('instance method decorator does not throw', () => {
        expect(() => {
            class Base extends Contracted() {
                method(): void {}
            }

            class Sub extends Base {
                @override
                method(): void {}
            }

            return Sub;
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/45
 */
describe('In production mode the @override decorator is a no-op', () => {
    test('base class with @override decorator', () => {
        expect(() => {
            class Base extends Contracted() {
                @override
                method(): void {}
            }

            return Base;
        }).not.toThrow();
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/46
 */
describe('Using @override on a class member with no ancestor member is an error', () => {
    test('base class with @override decorator', () => {
        expect(() => {
            class Base extends Contracted() {
                @override
                method(): void {}
            }

            return Base;
        }).toThrow(MSG_NO_MATCHING_FEATURE);
    });

    test('subclass with @override decorator', () => {
        expect(() => {
            class Base extends Contracted() {}

            class Sub extends Base {
                @override
                method(): void {}
            }

            return Sub;
        }).toThrow(MSG_NO_MATCHING_FEATURE);
    });

    test('subclass with method overriding non-method', () => {
        expect(() => {
            class Base extends Contracted() {
                method = 'foo';
            }

            class Sub extends Base {
                @override
                // @ts-ignore: Ignoring type error for JS check
                method(): void {}
            }

            return Sub;
        }).toThrow(MSG_NO_MATCHING_FEATURE);
    });
});

/**
 * https://github.com/final-hill/decorator-contracts/issues/47
 */
describe('using @override on a method with an ancestor with a different parameter count is an error', () => {
    test('bad override', () => {
        expect(() => {
            class Base extends Contracted() {
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            class Sub extends Base {
                @override
                method(a: string): string {
                    return a;
                }
            }

            return Sub;
        }).toThrow(MSG_INVALID_ARG_LENGTH);
    });

    test('bad override 2', () => {
        expect(() => {
            class Base extends Contracted() {
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
        }).toThrow(MSG_INVALID_ARG_LENGTH);
    });

    test('good override', () => {
        expect(() => {
            class Base extends Contracted() {
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            class Sub extends Base {
                @override
                method(a: string, b: string): string {
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
            class Base extends Contracted() {
                method(): void {}

                get foo(): number { return 3; }
            }

            class Sub extends Base {
                @override
                method(): void {}

                @override
                get foo(): number { return 4; }
            }

            return new Sub();
        }).not.toThrow();
    });

    test('@override missing', () => {
        expect(() => {
            class Base extends Contracted() {
                method(): void {}
            }

            class Sub extends Base {
                method(): void {}
            }

            return new Sub();
        }).toThrow('@override decorator missing on Sub.prototype.method');

        expect(() => {
            class Base extends Contracted() {
                get prop(): number { return 3; }
            }

            class Sub extends Base {
                get prop(): number { return 5; }
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
            class Base extends Contracted() {
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            class Sub extends Base {
                @override
                @override
                method(a: string, b: string): string {
                    return super.method(a, b);
                }
            }

            return Sub;
        }).toThrow(MSG_DUPLICATE_OVERRIDE);
    });

    test('Three level @override', () => {
        expect(() => {
            class Base extends Contracted() {
                method(a: string, b: string): string {
                    return `${a}, ${b}`;
                }
            }

            class Sub extends Base {
                @override
                method(a: string, b: string): string {
                    return super.method(a, b);
                }
            }

            class SubSub extends Sub {
                @override
                method(a: string, b: string): string {
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
            class Base extends Contracted() {
                #value = 0;
                get value(): number { return this.#value; }
                set value(x: number) { this.#value = x; }
            }

            class Sub extends Base {
                @override
                set value(x: number) {
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
        class Base extends Contracted() {
            method(value: number): number { return value; }
        }

        class Okay extends Base {
            @override
            method(value: number): number { return value; }
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
                method(value: number): number { return value; }
            }

            return new Fail();
        }).toThrow(MSG_NOT_CONTRACTED);
    });
});