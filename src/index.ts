/*!
 * Decorator Contracts v0.0.0 | Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import assertion from './assertion';
import ensures from './ensures';
import requires from './requires';
import overrideFactory from './override';

export default function(debugMode: boolean) {
    return {
        assert: assertion(debugMode),
        ensures: ensures(debugMode),
        requires: requires(debugMode),
        override: overrideFactory(debugMode)
    };
}