/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Demands, extend } from '../Contract';
import { assert, checkedMode, Contract } from '../';
import unChecked from './unChecked';

/**
 * Applies invariant assertions to the provided class instance
 *
 * @param {Record<PropertyKey, unknown>} ctx - The context class
 * @param {Contract<any>} contract - The contract
 * @param {string} className - The name of the class
 * @param {PropertyKey} featureName - The name of the feature
 * @param {any[]} args - The arguments of the feature to apply to the assertion
 */
function assertDemands(ctx: Record<PropertyKey, unknown>, contract: Contract<any>, className: string, featureName: PropertyKey, args: any[]){
    let result = true;
    const d: Demands<any, any> | undefined = Reflect.get(contract.assertions, featureName)?.demands,
        demandsError = `demands not met on ${className}.prototype.${String(featureName)}\r\n${d}`;
    if(contract[checkedMode]) {
        if(d) {
            unChecked(contract, () =>
                result = d.call(ctx,ctx, ...args)
            );
        }
    }

    if(contract[extend] && !result) {
        assertDemands(ctx,contract[extend]!, className, featureName, args);
    } else {
        assert(result,demandsError);
    }
}

export default assertDemands;