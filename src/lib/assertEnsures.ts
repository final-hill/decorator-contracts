/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Ensures, extend } from '../Contract';
import { assert, checkedMode, Contract } from '../';
import unChecked from './unChecked';

/**
 * Applies invariant assertions to the provided class instance
 *
 * @param {Record<PropertyKey, unknown>} ctx - The context class
 * @param {Contract<any>} contract - The contract
 * @param {string} className - The name of the class
 * @param {PropertyKey} featureName - The name of the feature
 * @param {Record<PropertyKey, unknown>} old - The original properties before execution
 * @param {any[]} args - The arguments of the feature to apply to the assertion
 */
function assertEnsures(
    ctx: Record<PropertyKey, unknown>,
    contract: Contract<any>,
    className: string,
    featureName: PropertyKey,
    old: Record<PropertyKey, unknown>,
    args: any[]
){
    let result = true;
    const e: Ensures<any, any> | undefined = Reflect.get(contract.assertions, featureName)?.ensures,
        ensuresError = `ensures not met on ${className}.prototype.${String(featureName)}\r\n${e}`;

    // TODO: inherited as OR assertions
    if(contract[checkedMode]) {
        if(e) {
            unChecked(contract, () =>
                result = e.call(ctx, ctx, old, ...args)
            );
        }
    }

    if(contract[extend] && !result) {
        assertEnsures(ctx, contract[extend]!, className, featureName, old, args);
    } else {
        assert(result, ensuresError);
    }
}

export default assertEnsures;