import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { Contracted } from '@final-hill/decorator-contracts'

describe('Contracted class tests', () => {
    test("A Contracted class can only be instantiated via the static 'new' method", () => {
        class Foo extends Contracted { }

        nodeAssert.throws(() => {
            return new Foo();
        }, TypeError);

        nodeAssert.doesNotThrow(() => {
            return Foo.new();
        })
    })

    test("typecheck constructor parameters", () => {
        class Bar extends Contracted {
            constructor(public a: number, public b: string) {
                super();
            }
        }

        const goodInstance = Bar.new(1, 'foo');

        nodeAssert.strictEqual(goodInstance.a, 1);

        // @ts-expect-error : Type error
        const badInstance = Bar.new(1, 2);

        nodeAssert.strictEqual(badInstance.a, 1);
    })

    test("Prevents assignment to public properties on Contracted instances", () => {
        class Foo extends Contracted {
            _private = 1;
            publicProp = 2;
        }
        const foo = Foo.new();

        // Allowed: property starts with '_'
        nodeAssert.doesNotThrow(() => {
            foo._private = 42;
        });

        // Not allowed: property does not start with '_'
        nodeAssert.throws(() => {
            foo.publicProp = 99;
        }, TypeError);

        // Not allowed: new property that does not start with '_'
        nodeAssert.throws(() => {
            // @ts-expect-error : Invalid property assignment
            foo.someOther = 123;
        }, TypeError);

        // Allowed: new property that starts with '_'
        nodeAssert.doesNotThrow(() => {
            // @ts-expect-error : Invalid property assignment
            foo._another = 456;
        });
    })

    test("The properties of contracted classes can not be deleted", () => {
        class Foo extends Contracted {
            _private = 1;
            publicProp = 2;
        }
        const foo = Foo.new();

        nodeAssert.throws(() => {
            // @ts-expect-error : Ignore type error
            delete foo.publicProp;
        }, TypeError);

        nodeAssert.throws(() => {
            // @ts-expect-error : Ignore type error
            delete foo._private;
        }, TypeError);

        nodeAssert.throws(() => {
            // @ts-expect-error : Ignore type error
            delete foo.nonexistent;
        }, TypeError);
    })

})