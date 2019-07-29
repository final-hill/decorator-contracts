/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import Assertion from './assertion';
import ensures from './ensures';
import requires from './requires';
import overrideFactory from './override';

export default function contracts(debugMode: boolean) {
    return {
        assert: new Assertion(debugMode).assert,
        ensures: ensures(debugMode),
        requires: requires(debugMode),
        override: overrideFactory(debugMode)
    };
}