/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { unChecked } from './';
import { assert, checkedMode, Contract, extend, invariant } from '../';

/**
 * Applies invariant assertions to the provided class instance
 *
 * @param {Record<PropertyKey, unknown>} ctx - The context class
 * @param {Contract<any>} contract - The contract
 */
function assertInvariants(ctx: Record<PropertyKey, unknown>, contract: Contract<any>) {
    if(contract[checkedMode]) {
        unChecked(contract,() => {
            const iv = contract[invariant];
            assert(iv.call(ctx, ctx),`Invariant violated. ${iv.toString()}`);
        });
    }

    if(contract[extend]) {
        assertInvariants(ctx,contract[extend]!);
    }
}

export default assertInvariants;