/*!
 * @license
 * Copyright (C) 2021 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import {deepFreeze} from './lib';

const checkedMode = Symbol('checkedMode'),
      invariants = Symbol('invariant');

type AnyObject = Record<PropertyKey, any>;
type AnyFunc = (...args: any[]) => any;

type NonFunctionPropertyNames<T extends AnyObject> = { [K in keyof T]: T[K] extends AnyFunc ? never : K }[keyof T];
type Properties<T extends AnyObject> = Pick<T, NonFunctionPropertyNames<T>>;

export type Invariant<T extends AnyObject> = (self: T) => boolean;
export type Demands<T extends AnyObject, F extends T[any]> = (self: T, ...args: Parameters<F>) => boolean;
export type Ensures<T extends AnyObject, F extends T[any]> = (self: T, old: Properties<T>, ...args: Parameters<F>) => boolean;
export type Rescue<T extends AnyObject, F extends T[any]> = (self: T, error: Error, args: Parameters<F>, retry: (...args: Parameters<F>) => void) => void;

export interface InvariantOption<T extends AnyObject> {
    [invariants]?: Invariant<T> | Invariant<T>[];
}

export interface CheckedOption {
    [checkedMode]?: boolean;
}

export type FeatureOptions<T extends AnyObject> = {
    [K in keyof T]?: FeatureOption<T, T[K]>
};

export type NormalizedFeatureOptions<T extends AnyObject> = {
    [K in keyof T]?: NormalizedFeatureContract<T, T[K]>
};

export interface FeatureOption<T extends AnyObject, F> {
    demands?: Demands<T,F> | Demands<T,F>[];
    ensures?: Ensures<T,F> | Ensures<T,F>[];
    rescue?: Rescue<T,F>;
}

export interface NormalizedFeatureContract<T extends AnyObject, F> {
    demands: Demands<T,F>[];
    ensures: Ensures<T,F>[];
    rescue?: Rescue<T,F>;
}

export type ContractOptions<T extends AnyObject> = InvariantOption<T> & CheckedOption & FeatureOptions<T>;

export type NormalizedContractOptions<T extends AnyObject> = NormalizedFeatureOptions<T>;

// TODO: extending a Contract?

export class Contract<T extends AnyObject> {
    [checkedMode]: boolean;
    [invariants]: Invariant<T>[];
    readonly assertions: NormalizedContractOptions<T> = Object.create(null);

    constructor(assertions: ContractOptions<T> = {}) {
        this[checkedMode] = assertions[checkedMode] ?? true;
        this[invariants] = ([] as Invariant<T>[]).concat(assertions[invariants] ?? []);

        Object.keys(assertions).forEach(propertyKey => {
            const featureOption = assertions[propertyKey]!;
            Object.defineProperty(this.assertions,propertyKey, {
                value: {
                    demands: ([] as Demands<T, any>[]).concat(featureOption.demands ?? []),
                    ensures: ([] as Ensures<T, any>[]).concat(featureOption.ensures ?? []),
                    rescue: featureOption.rescue
                }
            });
        });

        deepFreeze(this.assertions);
    }
}

export {checkedMode, invariants as invariant};