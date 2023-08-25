/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { checkedMode, Contract } from '../';

/**
 * Disable contract checking for the provided function
 * @param {Contract<any>} contract - The code contract
 * @param {function(...args: any[]): any} fn - The function to execute
 */
const unChecked = (contract: Contract<any>, fn: () => any) => {
    try {
        contract[checkedMode] = false;
        fn();
    } finally {
        contract[checkedMode] = true;
    }
};

export default unChecked;