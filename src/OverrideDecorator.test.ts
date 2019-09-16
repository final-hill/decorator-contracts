/**
 * @license
 * Copyright (C) __YEAR__ Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 *
 * Unit tests for the override decorator
 */

import OverrideDecorator from './OverrideDecorator';
import AssertionError from './AssertionError';

describe('debugMode @override', () => {
    let override = new OverrideDecorator(true).override;

    test('Override on Base class should throw', () => {
        expect(() => {
            class Base {
                @override
                method() {}
            }

            return new Base();
        }).toThrow(AssertionError);
    });

    test('Override on subclass method without ancestor should throw', () => {
        expect(() => {
            class Base {}

            class Sub extends Base {
                @override
                method() {}
            }

            return new Sub();
        }).toThrow(AssertionError);
    });

    test('Matching override member should not throw', () => {
        expect(() => {
            class Base {
                method() {}
            }

            class Sub extends Base {
                @override
                method() {}
            }

            return new Sub();
        }).not.toThrow();
    });
});

describe('prodMode @override', () => {
    let override = new OverrideDecorator(false).override;

    test('Override on Base class should not throw', () => {
        expect(() => {
            class Base {
                @override
                method() {}
            }

            return new Base();
        }).not.toThrow();
    });

    test('Override on subclass method without ancestor should not throw', () => {
        expect(() => {
            class Base {}

            class Sub extends Base {
                @override
                method() {}
            }

            return new Sub();
        }).not.toThrow(AssertionError);
    });

    test('Matching override member should not throw', () => {
        expect(() => {
            class Base {
                method() {}
            }

            class Sub extends Base {
                @override
                method() {}
            }

            return new Sub();
        }).not.toThrow();
    });
});