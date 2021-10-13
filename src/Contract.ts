/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {deepFreeze, fnTrue} from './lib';

const checkedMode = Symbol('checkedMode'),
      invariant = Symbol('invariant'),
      extend = Symbol('extend');

type AnyObject = Record<PropertyKey, any>;
type AnyFunc = (...args: any[]) => any;

type NonFunctionPropertyNames<T extends AnyObject> = { [K in keyof T]: T[K] extends AnyFunc ? never : K }[keyof T];
type Properties<T extends AnyObject> = Pick<T, NonFunctionPropertyNames<T>>;

export type Invariant<T extends AnyObject> = (self: T) => boolean;
export type Demands<T extends AnyObject, F extends T[any]> = (self: T, ...args: Parameters<F>) => boolean;
export type Ensures<T extends AnyObject, F extends T[any]> = (self: T, old: Properties<T>, ...args: Parameters<F>) => boolean;
export type Rescue<T extends AnyObject, F extends T[any]> = (
    self: T,
    error: Error,
    args: F extends AnyFunc ? Parameters<F> : [F],
    retry: F extends AnyFunc ? (...args: Parameters<F>) => any : (value: F) => void
) => void;

export type ContractOptions<
    T extends AnyObject
> = {
    [extend]: Contract<T>;
    [invariant]: Invariant<T>;
    [checkedMode]: boolean;
} & {
    [K in keyof T]?: FeatureOption<T, T[K]>
};

export interface FeatureOption<T extends AnyObject, F extends T[any]> {
    demands?: Demands<T,F>;
    ensures?: Ensures<T,F>;
    rescue?: Rescue<T,F>;
    within?: number;
}

export class Contract<T extends AnyObject> {
    #invariant: Invariant<T>;
    [checkedMode]: boolean;
    readonly [extend]?: Contract<T>;
    readonly assertions: ContractOptions<T> = Object.create(null);
    get [invariant](): Invariant<T> {
        return this.#invariant;
    }

    constructor(assertions: Partial<ContractOptions<T>> = Object.create(null)) {
        this[extend] = assertions[extend];
        this[checkedMode] = assertions[checkedMode] ?? true;
        this.#invariant = assertions[invariant] ?? fnTrue;

        Object.keys(assertions).forEach(propertyKey => {
            const featureOption = assertions[propertyKey]!;
            Object.defineProperty(this.assertions,propertyKey, {
                value: {
                    demands: featureOption.demands ?? fnTrue,
                    ensures: featureOption.ensures ?? fnTrue,
                    rescue: featureOption.rescue,
                    within: featureOption.within
                }
            });
        });

        deepFreeze(this.assertions);
    }
}

export {checkedMode, extend, invariant};