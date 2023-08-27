/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

/**
 * An AssertionError represents a failed assertion with an associated message
 */
class AssertionError extends Error {
    /**
     * Constructs a new instance of AssertionError
     *
     * @param {string} message - The associated message
     */
    constructor(message: string) {
        super(message);
    }
}

export default AssertionError;