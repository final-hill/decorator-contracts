import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { iff, implies } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/322
 *
 * Both combinators are declared as returning `boolean`, but the logical operators
 * they are built from return an *operand* rather than a boolean. A truthy
 * non-boolean operand therefore escaped the signature whenever it sat on the
 * returned side of the short-circuit, which is why testing with booleans on that
 * side always looked correct.
 */
describe('`iff` always returns a boolean', () => {
    describe('the truth table', () => {
        test('is true when both operands agree', () => {
            nodeAssert.equal(iff(true, true), true);
            nodeAssert.equal(iff(false, false), true);
        });

        test('is false when the operands disagree', () => {
            nodeAssert.equal(iff(true, false), false);
            nodeAssert.equal(iff(false, true), false);
        });
    });

    describe('a non-boolean operand is coerced, not leaked', () => {
        const truthy = { amount: 10 };
        const falsy = 0;

        test('a truthy object in the consequent position is returned as `true`', () => {
            const result = (iff as any)(true, truthy);

            nodeAssert.equal(typeof result, 'boolean');
            nodeAssert.equal(result, true);
            nodeAssert.notEqual(result, truthy, 'the operand must not escape');
        });

        test('a truthy object in the antecedent position is returned as `true`', () => {
            const result = (iff as any)(truthy, truthy);

            nodeAssert.equal(typeof result, 'boolean');
            nodeAssert.equal(result, true);
        });

        test('a falsy non-boolean in both positions is `true`, because they agree', () => {
            nodeAssert.equal((iff as any)(falsy, falsy), true);
        });

        test('a falsy non-boolean against `true` is `false`', () => {
            nodeAssert.equal((iff as any)(falsy, true), false);
            nodeAssert.equal((iff as any)(true, falsy), false);
        });
    });
});

describe('`implies` always returns a boolean', () => {
    describe('the truth table', () => {
        test('is false only when the antecedent holds and the consequent does not', () => {
            nodeAssert.equal(implies(true, true), true);
            nodeAssert.equal(implies(true, false), false);
            nodeAssert.equal(implies(false, true), true);
            nodeAssert.equal(implies(false, false), true);
        });

        test('a false antecedent satisfies the implication regardless of the consequent', () => {
            nodeAssert.equal(implies(false, false), true);
        });
    });

    describe('a non-boolean operand is coerced, not leaked', () => {
        const truthy = { amount: 10 };
        const falsy = 0;

        test('a truthy object in the consequent position is returned as `true`', () => {
            const result = (implies as any)(true, truthy);

            nodeAssert.equal(typeof result, 'boolean');
            nodeAssert.equal(result, true);
            nodeAssert.notEqual(result, truthy, 'the operand must not escape');
        });

        test('a falsy non-boolean consequent makes the implication false', () => {
            nodeAssert.equal((implies as any)(true, falsy), false);
        });

        test('a falsy antecedent satisfies the implication whatever the consequent is', () => {
            nodeAssert.equal((implies as any)(falsy, truthy), true);
            nodeAssert.equal((implies as any)(falsy, falsy), true);
        });
    });
});

describe('the README Boolean guarantee', () => {
    test('both combinators satisfy the documented claim for non-boolean operands', () => {
        const truthyObject = { seat: 'A1' };

        // README: "Both functions always return a boolean, even when an operand is
        // not a boolean: a truthy object is coerced rather than passed through."
        for (const [label, result] of [
            ['iff(true, object)', (iff as any)(true, truthyObject)],
            ['iff(object, object)', (iff as any)(truthyObject, truthyObject)],
            ['implies(true, object)', (implies as any)(true, truthyObject)],
            ['implies(false, object)', (implies as any)(false, truthyObject)],
        ] as const) {
            nodeAssert.equal(typeof result, 'boolean', label);
        }
    });
});

describe('both combinators compose with the contracts', () => {
    test('a coerced boolean satisfies a contract predicate', async () => {
        const { Contracted, demands } = await import('@final-hill/decorator-contracts');

        class Order extends Contracted {
            // Both operands are deliberately non-boolean. `iff` returns a
            // boolean rather than an operand, so the strict-boolean check is
            // satisfied.
            public _paid: any = { amount: 10 };
            public _hasTicket: any = { seat: 'A1' };

            @demands(function ({ self }) { return iff(self._paid, self._hasTicket); })
            board(): string { return 'boarded'; }
        }

        nodeAssert.equal((Order.new() as Order).board(), 'boarded');
    });
});
