import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, checkedMode, Contracted, ensures } from '@final-hill/decorator-contracts'

/**
 * https://github.com/final-hill/decorator-contracts/issues/280
 */
describe('A failure while snapshotting the `old` instance must not disable checked mode', () => {
    const makeThrowingSnapshotClass = () => {
        class Foo extends Contracted {
            constructor() {
                super();
                // An own enumerable getter is visited by `populateOld` while building `old`.
                Object.defineProperty(this, 'boom', {
                    enumerable: true,
                    configurable: true,
                    get() { throw new Error('snapshot boom'); }
                });
            }

            @ensures(() => true)
            m(): void { }
        }

        return Foo;
    }

    test('the original error is raised to the caller', () => {
        const Foo = makeThrowingSnapshotClass(),
            foo = Foo.new();

        nodeAssert.throws(() => foo.m(), { message: 'snapshot boom' });
    });

    test('checked mode is restored', () => {
        const Foo = makeThrowingSnapshotClass(),
            foo = Foo.new();

        try {
            nodeAssert.throws(() => foo.m(), { message: 'snapshot boom' });
            nodeAssert.strictEqual(Contracted[checkedMode], true);
        } finally {
            Contracted[checkedMode] = true;
        }
    });

    test('contracts remain enforced for unrelated classes', () => {
        const Foo = makeThrowingSnapshotClass(),
            foo = Foo.new();

        try {
            nodeAssert.throws(() => foo.m(), { message: 'snapshot boom' });

            class Bar extends Contracted {
                @ensures(() => false)
                n(): void { }
            }

            nodeAssert.throws(() => Bar.new().n(), AssertionError);
        } finally {
            Contracted[checkedMode] = true;
        }
    });
})

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