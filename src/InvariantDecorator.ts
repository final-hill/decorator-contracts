/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import {ContractHandler, contractHandler} from './ContractHandler';
import { OVERRIDE_LIST } from './OverrideDecorator';
import isConstructor from './lib/isConstructor';
import FnPredTable from './typings/FnPredTable';
import DescriptorWrapper from './lib/DescriptorWrapper';
import Constructor from './typings/Constructor';

type ClassDecorator = <T extends Constructor<any>>(Constructor: T) => T;

export const MSG_INVALID_DECORATOR = 'Invalid decorator usage. Function expected';
export const MSG_DUPLICATE_INVARIANT = `Only a single @invariant can be assigned per class`;
export const HAS_INVARIANT = Symbol('Has Invariant');
const TRUE_PRED = () => ({ pass: true });
let checkedAssert = new Assertion(true).assert;

/**
 * Returns the feature names associated with the provided prototype
 */
function _featureNames(proto: object): Set<PropertyKey> {
    return proto == null ? new Set() : new Set(
        Object.entries(Object.getOwnPropertyDescriptors(proto))
        .filter(([key, descriptor]) => {
            let dw = new DescriptorWrapper(descriptor);

            return (dw.isMethod || dw.isAccessor) && key != 'constructor';
        })
        .map(([key, _]) => key)
    );
}

/**
 * Returns the feature names defined on the provided prototype and its ancestors
 */
function _ancestorFeatureNames(targetProto: object): Set<PropertyKey> {
    if(targetProto == null) {
        return new Set();
    }
    let proto = Object.getPrototypeOf(targetProto);

    return proto == null ? new Set() :
        new Set([..._featureNames(proto), ..._ancestorFeatureNames(proto)]);
}

interface IDecorated {
    [OVERRIDE_LIST]?: Set<PropertyKey>
}

function _checkOverrides(Clazz: Function & IDecorated) {
    let proto = Clazz.prototype;
    if(proto == null) {
        return;
    }
    let clazzSymbols = Object.getOwnPropertySymbols(Clazz),
        featureNames = _featureNames(proto);

    let overrides: Set<PropertyKey> = clazzSymbols.includes(OVERRIDE_LIST) ?
            Clazz[OVERRIDE_LIST]! : new Set(),
        ancestorFeatureNames: Set<PropertyKey> = _ancestorFeatureNames(proto);

    featureNames.forEach(featureName =>
        checkedAssert(
            overrides.has(featureName) || !ancestorFeatureNames.has(featureName),
            `@override decorator missing on ${Clazz.name}.${String(featureName)}`
        )
    );
}

/**
 * The `@invariant` decorator describes and enforces the properties of a class
 * via assertions. These assertions are checked after the associated class
 * is constructed, before and after every method execution, and before and after
 * every accessor usage (get/set).
 */
export default class InvariantDecorator {
    protected _assert: typeof Assertion.prototype.assert;

    constructor(protected checkMode: boolean) {
        this._assert = new Assertion(checkMode).assert;
        this.invariant = this.invariant.bind(this);
    }

    invariant<T extends Constructor<any>>(Base: T): T;
    invariant<Self>(fnPredTable: FnPredTable<Self>): ClassDecorator;
    invariant<U extends (Constructor<any> | any)>(fn: Function) {
        let predTable = isConstructor(fn) ? TRUE_PRED : fn as FnPredTable<U>,
            Clazz = isConstructor(fn) ? fn : undefined,
            assert = this._assert,
            checkMode = this.checkMode;

        assert(typeof fn == 'function', MSG_INVALID_DECORATOR);

        function decorator(Base: any) {
            if(!checkMode) {
                return Base;
            }

            let hasHandler = Object.getOwnPropertySymbols(Base).includes(contractHandler);
            assert(!hasHandler, MSG_DUPLICATE_INVARIANT);

            let handler: ContractHandler = new ContractHandler(assert, predTable);

            return class InvariantClass extends Base {
                static [contractHandler]: ContractHandler = handler;
                static [HAS_INVARIANT] = true;

                constructor(...args: any[]) {
                    super(...args);

                    // TODO: move to OverrideDecorator
                    _checkOverrides(this.constructor);
                    InvariantClass[contractHandler].assertInvariants(this);

                    return new Proxy(this, handler);
                }
            };
        }

        return isConstructor(fn) ? decorator(Clazz!) : decorator;
    }
}