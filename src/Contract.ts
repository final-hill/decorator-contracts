/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

const invariant = Symbol('invariant');

abstract class Contract<S> {
    [invariant]: ((self: S) => boolean) = () => true;
}

export {invariant, Contract};
export default Contract;