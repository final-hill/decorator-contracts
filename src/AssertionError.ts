/**
 * @license
 * Copyright (C) __YEAR__ Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
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