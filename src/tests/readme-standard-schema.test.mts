import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { AssertionError, Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';
import type { StandardSchemaV1 } from '@final-hill/decorator-contracts';

/**
 * https://github.com/final-hill/decorator-contracts/issues/279
 *
 * These mirror the README's "Standard Schema" section. A `zod`-shaped object is
 * imitated rather than imported, because the section's claim is precisely that no
 * provider is a dependency.
 */
const imitate = <Output,>(validate: (value: unknown) => StandardSchemaV1.Result<Output>): StandardSchemaV1<unknown, Output> => ({
    '~standard': { version: 1, vendor: 'zod', validate },
});

const positive = imitate<number>(value =>
    typeof value === 'number' && value > 0
        ? { value }
        : { issues: [{ message: 'Number must be greater than 0' }] });

const quantity = imitate<[number]>((value: any) =>
    Array.isArray(value) && value.length === 1 && typeof value[0] === 'number' && value[0] > 0
        ? { value: [value[0] as number] }
        : { issues: [{ message: 'Expected a tuple of one positive number' }] });

class Inventory extends Contracted {
    protected _stock = 0;
    get stock() { return this._stock; }

    @demands(quantity)
    @ensures(positive)
    add(...[count]: [number]): number {
        this._stock += count;

        return this._stock;
    }
}

describe('README Standard Schema examples', () => {
    test('a schema on @demands validates the argument tuple', () => {
        const inventory = Inventory.new() as Inventory;

        nodeAssert.equal(inventory.add(2), 2);
        nodeAssert.equal(inventory.stock, 2);
    });

    test('a schema on @ensures validates the result', () => {
        const inventory = Inventory.new() as Inventory;

        nodeAssert.equal(inventory.add(1), 1);
    });

    test('the failure carries the provider issues', () => {
        const inventory = Inventory.new() as Inventory;

        try {
            inventory.add(-1);
        } catch (error) {
            nodeAssert.ok(error instanceof AssertionError);
            nodeAssert.equal(error.violation?.contract, '@demands');
            nodeAssert.deepEqual(
                error.violation?.issues?.map(issue => issue.message),
                ['Expected a tuple of one positive number'],
            );

            return;
        }

        throw new Error('expected the call to fail');
    });

    test('the message carries the issue text', () => {
        nodeAssert.throws(() => (Inventory.new() as Inventory).add(-1),
            /Expected a tuple of one positive number/);
    });

    @invariant(imitate<unknown>(value =>
        typeof (value as any)?._stock === 'number'
            ? { value }
            : { issues: [{ message: 'stock must be a number' }] }))
    class Guarded extends Contracted {
        public _stock = 0;
    }

    test('a schema on @invariant validates the instance', () => {
        nodeAssert.equal((Guarded.new() as Guarded)._stock, 0);
    });
});
