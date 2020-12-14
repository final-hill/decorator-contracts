/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

 /**
 * Apply Object.freeze recursively
 * @param {object} object -
 */
function deepFreeze(object: object): void {
    // Freeze properties before freezing self
    for (const [,value] of Object.entries(object)) {
        if (value != undefined && typeof value === 'object') {
            deepFreeze(value);
        }
    }
}

export default deepFreeze;