/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import assertDemands from './assertDemands';
import assertEnsures from './assertEnsures';
import assertInvariants from './assertInvariants';
import CLASS_REGISTRY from './CLASS_REGISTRY';
import ClassRegistration from './ClassRegistration';
import { ClassType } from './ClassType';
import deepFreeze from './deepFreeze';
import Feature from './Feature';
import takeWhile from './takeWhile';
import unChecked from './unChecked';

const fnTrue = () => true;

export {
    assertDemands,
    assertEnsures,
    assertInvariants,
    CLASS_REGISTRY,
    ClassRegistration,
    ClassType,
    deepFreeze,
    Feature,
    fnTrue,
    takeWhile,
    unChecked
};