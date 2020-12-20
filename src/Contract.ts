/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import deepFreeze from './lib/deepFreeze';

const invariant = Symbol('invariant');

type NonFunctionPropertyNames<T extends object> = { [K in keyof T]: T[K] extends Function ? never : K }[keyof T];
type Properties<T extends object> = Pick<T, NonFunctionPropertyNames<T>>;

type Invariant<T extends object> = (self: T) => boolean;
type Demands<T extends object,F extends T[any]> = (self: T, ...args: Parameters<F>) => boolean;
type Ensures<T extends object,F extends T[any]> = (self: T, old: Properties<T>, ...args: Parameters<F>) => boolean;
type Rescue<T extends object,F extends T[any]> = (self: T, error: Error, args: Parameters<F>, retry: (...args: Parameters<F>) => void) => void;

interface InvariantContract<T extends object> {
    [invariant]?: Invariant<T> | Invariant<T>[];
}

interface FeatureContract<T extends object, F> {
    demands?: Demands<T,F> | Demands<T,F>[];
    ensures?: Ensures<T,F> | Ensures<T,F>[];
    rescue?: Rescue<T,F> | Rescue<T,F>[];
}

export type ContractOptions<T extends object> = InvariantContract<T> & {
    [K in keyof T]?: FeatureContract<T, T[K]>
};

class Contract<T extends object> {
    assertions: ContractOptions<T> = Object.create(null);

    constructor(assertions: ContractOptions<T> = {}) {
        Object.assign(this.assertions,assertions);
        deepFreeze(this.assertions);
    }
}

export {Contract, invariant};
export default Contract;