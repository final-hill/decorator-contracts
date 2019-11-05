/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

/**
 * An AssertionError represents a failed assertion with an associated message
 */
class AssertionError extends Error {
    /**
     * Constructs a new instance of AssertionError
     *
     * @param message The associated message
     */
    constructor(message: string) {
        super(message);
    }
}

export default AssertionError;