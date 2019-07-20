/*!
 * SPDX-License-Identifier: GPL-2.0-only
 */

class AssertionError extends Error {
    constructor(message: string) {
        super(message);
    }
}

export default AssertionError;