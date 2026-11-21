import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/289
 */

const capture = (fn: () => unknown): AssertionError => {
    try {
        fn();
    } catch (error) {
        nodeAssert.ok(error instanceof AssertionError, `expected an AssertionError, got ${error}`);
        return error;
    }

    nodeAssert.fail('expected a contract failure');
}

describe('AssertionError identifies itself', () => {
    test('`name` is `AssertionError`, not `Error`', () => {
        nodeAssert.strictEqual(new AssertionError('x').name, 'AssertionError');
    });

    test('`name` survives bundling because it is an own property', () => {
        // Bundlers rename classes, so a consumer would otherwise observe a
        // mangled name from the prototype chain.
        const error = new AssertionError('x');

        nodeAssert.ok(Object.hasOwn(error, 'name'));
    });

    test('it is still an `Error` and an `AssertionError`', () => {
        const error = new AssertionError('x');

        nodeAssert.ok(error instanceof Error);
        nodeAssert.ok(error instanceof AssertionError);
    });

    test('a contract failure is an `AssertionError`', () => {
        class Foo extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        nodeAssert.throws(() => (Foo.new() as any).method(), AssertionError);
    });

    test('`stack` starts with the class name', () => {
        const error = new AssertionError('boom');

        nodeAssert.match(String(error.stack), /^AssertionError: boom/);
    });
});

describe('A contract failure is described in its message', () => {
    test('`@demands` names the contract, the feature, and every arm', () => {
        class Foo extends Contracted {
            @demands(() => false)
            @demands(() => false)
            method(): void { }
        }

        const error = capture(() => (Foo.new() as any).method());

        nodeAssert.match(error.message, /^@demands failed for Foo\.method/);
        nodeAssert.match(error.message, /predicate #1/);
        nodeAssert.match(error.message, /predicate #2/);
        nodeAssert.match(error.message, /2 of 2 predicates unsatisfied/);
    });

    test('`@ensures` identifies the specific predicate that failed', () => {
        class Foo extends Contracted {
            @ensures(() => true)
            @ensures(() => false)
            @ensures(() => true)
            method(): void { }
        }

        const error = capture(() => (Foo.new() as any).method());

        nodeAssert.match(error.message, /^@ensures failed for Foo\.method/);
        nodeAssert.match(error.message, /1 of 3 predicates unsatisfied/);
        nodeAssert.match(error.message, /predicate #2/);
    });

    test('`@invariant` names the class and the failing predicate', () => {
        @invariant((self: Foo) => self.value > 0)
        class Foo extends Contracted {
            get value() { return 0; }
        }

        const error = capture(() => Foo.new());

        nodeAssert.match(error.message, /^@invariant failed for Foo/);
        nodeAssert.match(error.message, /1 of 1 predicate unsatisfied/);
        nodeAssert.match(error.message, /predicate #1/);
    });

    test('wording is consistent across the three contracts', () => {
        class D extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        class E extends Contracted {
            @ensures(() => false)
            method(): void { }
        }

        @invariant(() => false)
        class I extends Contracted {
            method(): void { }
        }

        const messages = [
            capture(() => (D.new() as any).method()).message,
            capture(() => (E.new() as any).method()).message,
            capture(() => I.new()).message,
        ];

        for (const message of messages) {
            nodeAssert.match(message, /predicate #\d+/);
            nodeAssert.match(message, /unsatisfied/);
            nodeAssert.doesNotMatch(message, /ensurances/);
        }
    });
});

describe('A contract failure carries a structured payload', () => {
    test('`@demands` lists every arm, because OR-composition means any could permit the call', () => {
        class Foo extends Contracted {
            @demands((_self: Foo, [v]: [number]) => v > 0)
            @demands((_self: Foo, [v]: [number]) => v === 42)
            method(_v: number): void { }
        }

        const error = capture(() => (Foo.new() as any).method(-1)),
            violation = error.violation!;

        nodeAssert.strictEqual(violation.contract, '@demands');
        nodeAssert.strictEqual(violation.className, 'Foo');
        nodeAssert.strictEqual(violation.feature, 'method');
        nodeAssert.deepStrictEqual(violation.failedIndices, [0, 1]);
        nodeAssert.strictEqual(violation.predicates.length, 2);
    });

    test('`@ensures` lists only the predicates that failed', () => {
        class Foo extends Contracted {
            @ensures(() => true)
            @ensures(() => false)
            method(): void { }
        }

        const violation = capture(() => (Foo.new() as any).method()).violation!;

        nodeAssert.strictEqual(violation.contract, '@ensures');
        nodeAssert.strictEqual(violation.feature, 'method');
        nodeAssert.deepStrictEqual(violation.failedIndices, [0]);
    });

    test('`@invariant` has no feature', () => {
        @invariant(() => false)
        class Foo extends Contracted { }

        const violation = capture(() => Foo.new()).violation!;

        nodeAssert.strictEqual(violation.contract, '@invariant');
        nodeAssert.strictEqual(violation.className, 'Foo');
        nodeAssert.strictEqual(violation.feature, undefined);
    });

    test('the predicate source is included for diagnostics', () => {
        class Foo extends Contracted {
            @demands(() => false)
            method(): void { }
        }

        const violation = capture(() => (Foo.new() as any).method()).violation!;

        // the source is the minified text from the bundle, so compare shape
        nodeAssert.strictEqual(violation.predicates.length, 1);
        nodeAssert.match(violation.predicates[0], /false/);
    });

    test('a plain `assert` failure has no payload', () => {
        const error = capture(() => { throw new AssertionError('just a message'); });

        nodeAssert.strictEqual(error.violation, undefined);
    });
});
