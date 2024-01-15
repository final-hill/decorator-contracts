/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { unChecked } from './index.mjs';
import { assert, checkedMode, Contract, extend, invariant } from '../index.mjs';

/**
 * Applies invariant assertions to the provided class instance
 *
 * @param {U} ctx - The context class
 * @param {Contract<any>} contract - The contract
 * @throws {AssertionError}
 */
function assertInvariants<U>(ctx: U, contract: Contract<any>) {
    if (contract[checkedMode])
        unChecked(contract, () => {
            const iv = contract[invariant];
            assert(iv.call(ctx, ctx), `Invariant violated. ${iv.toString()}`);
        });

    if (contract[extend])
        assertInvariants(ctx, contract[extend]!);
}

export default assertInvariants;