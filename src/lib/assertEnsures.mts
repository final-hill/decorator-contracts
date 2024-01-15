/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Ensures, extend, Properties } from '../Contract.mjs';
import { assert, checkedMode, Contract } from '../index.mjs';
import unChecked from './unChecked.mjs';

/**
 * Applies invariant assertions to the provided class instance
 *
 * @param {U} ctx - The context class
 * @param {Contract<any>} contract - The contract
 * @param {string} className - The name of the class
 * @param {PropertyKey} featureName - The name of the feature
 * @param {U} old - The original properties before execution
 * @param {any[]} args - The arguments of the feature to apply to the assertion
 * @throws {AssertionError}
 */
function assertEnsures<U extends Properties<any>>(
    ctx: U,
    contract: Contract<any>,
    className: string,
    featureName: PropertyKey,
    old: U,
    args: any[]
) {
    const e: Ensures<any, any> | undefined = Reflect.get(contract.assertions, featureName)?.ensures,
        ensuresError = `ensures not met on ${className}.prototype.${String(featureName)}\r\n${e}`;

    if (contract[checkedMode])
        if (e)
            unChecked(contract, () =>
                assert(e.call(ctx, ctx, old, ...args), ensuresError)
            );

    if (contract[extend])
        assertEnsures(ctx, contract[extend]!, className, featureName, old, args);
}

export default assertEnsures;