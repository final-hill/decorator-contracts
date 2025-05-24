import { describe, test } from 'node:test';
import nodeAssert from 'node:assert/strict';
import { assert, AssertionError } from '@final-hill/decorator-contracts';

describe('The assertion function must support assertion signatures from TypeScript 3.7+', () => {
    test('Test assertion', () => {
        nodeAssert.strictEqual(assert(true), undefined);
        nodeAssert.throws(() => assert(false), AssertionError);

        const a: any = 'foo';

        // No type error
        let b = 5 * a;

        assert(typeof a === 'string');

        // @ts-expect-error  Type error after assertion
        b = 5 * a;

        nodeAssert(isNaN(b));
    });
});