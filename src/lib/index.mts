/*!
 * @license
 * Copyright (C) 2024 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import assertDemands from './assertDemands.mjs';
import assertEnsures from './assertEnsures.mjs';
import assertInvariants from './assertInvariants.mjs';
import classRegistry from './classRegistry.mjs';
import ClassRegistration from './ClassRegistration.mjs';
import { type ClassType } from './ClassType.mjs';
import deepFreeze from './deepFreeze.mjs';
import Feature from './Feature.mjs';
import takeWhile from './takeWhile.mjs';
import unChecked from './unChecked.mjs';

const fnTrue = () => true;

export {
    assertDemands,
    assertEnsures,
    assertInvariants,
    classRegistry,
    ClassRegistration,
    ClassType,
    deepFreeze,
    Feature,
    fnTrue,
    takeWhile,
    unChecked
};