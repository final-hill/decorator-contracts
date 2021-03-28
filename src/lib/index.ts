/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import CLASS_REGISTRY from './CLASS_REGISTRY';
import ClassRegistration from './ClassRegistration';
import deepFreeze from './deepFreeze';
import Feature from './Feature';
import takeWhile from './takeWhile';
import unChecked from './unChecked';

const fnTrue = () => true;

export {
    CLASS_REGISTRY,
    ClassRegistration,
    deepFreeze,
    Feature,
    fnTrue,
    takeWhile,
    unChecked
};