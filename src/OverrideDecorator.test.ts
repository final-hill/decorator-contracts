/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 *
 * Unit tests for the override decorator
 */

import Contracts from './';

/**
 * Requirement 210
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/210
 */
describe('The override decorator is a non-static method decorator only', () => {
    let {override} = new Contracts(true);

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
                static method() {}
            }

            return Base;
        }).toThrow();
    });

    test('instance method decorator does not throw', () => {
        expect(() => {
            class Base {
                method() {}
            }

            class Sub extends Base {
                @override
                method() {}
            }

            return Sub;
        }).not.toThrow();
    });
});

/**
 * Requirement 211
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/211
 */
describe('In production mode the @override decorator is a no-op', () => {
    let {override} = new Contracts(false);

    test('base class with @override decorator', () => {
        expect(() => {
            class Base {
                @override
                method() {}
            }

            return Base;
        }).not.toThrow();
    });
});

/**
 * Requirement 212
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/212
 */
describe('Using @override on a method with no ancestor method is an error', () => {
    let {override} = new Contracts(true);

    test('base class with @override decorator', () => {
        expect(() => {
            class Base {
                @override
                method() {}
            }

            return Base;
        }).toThrow();
    });

    test('subclass with @override decorator', () => {
        expect(() => {
            class Base {}

            class Sub extends Base {
                @override
                method() {}
            }

            return Sub;
        }).toThrow();
    });
});

/**
 * Requirement 214
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/214
 */
describe('using @override on a method with an ancestor with a different parameter count is an error', () => {
    let {override} = new Contracts(true);

    test('bad override', () => {
        expect(() => {
            class Base {
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            class Sub extends Base {
                @override
                method(a: string) {
                    console.log(a);
                }
            }

            return Sub;
        }).toThrow();
    });

    test('bad override 2', () => {
        expect(() => {
            class Base {
                method(a: string) {
                    console.log(`${a}`);
                }
            }

            class Sub extends Base {
                @override
                // @ts-ignore: type error for JS test
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            return Sub;
        }).toThrow();
    });

    test('good override', () => {
        expect(() => {
            class Base {
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            class Sub extends Base {
                @override
                method(a: string, b: string) {
                    super.method(a, b);
                }
            }

            return Sub;
        }).not.toThrow();
    });

});

/**
 * Requirement 215
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/215
 */
describe('A subclass with an overriding method missing @override is an error', () => {
    //let override = new OverrideDecorator(true).override;

});

/**
 * Requirement 337
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/337
 */
describe('Only a single @override can be assigned to a method per class', () => {
    let {override} = new Contracts(true);

    test('duplicate @override', () => {
        expect(() => {
            class Base {
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            class Sub extends Base {
                @override
                @override
                method(a: string, b: string) {
                    super.method(a, b);
                }
            }

            return Sub;
        }).toThrow();
    });

    test('Three level @override', () => {
        expect(() => {
            class Base {
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            class Sub extends Base {
                @override
                method(a: string, b: string) {
                    super.method(a, b);
                }
            }

            class SubSub extends Sub {
                @override
                method(a: string, b: string) {
                    super.method(a, b);
                }
            }

            return SubSub;
        }).not.toThrow();
    });
});

/**
 * Requirement 346
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/346
 */
describe('A class with an @override defined must also have an @invariant defined', () => {
    let {override, invariant} = new Contracts(true);

    test('unused override w/out invariant does not throw', () => {
        expect(() => {
            class Base {
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            class Sub extends Base {
                @override
                method(a: string, b: string) {
                    super.method(a, b);
                }
            }

            return new Sub();
        }).not.toThrow();
    });

    test('used override w/out invariant throws', () => {
        expect(() => {
            class Base {
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            class Sub extends Base {
                @override
                method(a: string, b: string) {
                    super.method(a, b);
                }
            }

            return new Sub().method('a', 'b');
        }).toThrow();
    });

    test('used override with local invariant does not throw', () => {
        expect(() => {
            class Base {
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            @invariant()
            class Sub extends Base {
                @override
                method(a: string, b: string) {
                    super.method(a, b);
                }
            }

            return new Sub().method('a', 'b');
        }).not.toThrow();
    });

    test('used override with ancestor invariant does not throw', () => {
        expect(() => {
            @invariant()
            class Base {
                method(a: string, b: string) {
                    console.log(`${a}, ${b}`);
                }
            }

            class Sub extends Base {
                @override
                method(a: string, b: string) {
                    super.method(a, b);
                }
            }

            return new Sub().method('a', 'b');
        }).not.toThrow();
    });

});