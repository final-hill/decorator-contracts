/*!
 * @license
 * Copyright (C) 2020 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { Ensures } from 'Contract';
import DescriptorWrapper from './lib/DescriptorWrapper';
import {assert, checkedMode, Contract, Invariant, Demands, Rescue, invariant} from './';

/**
 * The ContractHandler manages the evaluation of contract assertions for a class
 */
class ContractHandler implements ProxyHandler<any> {
    /**
     * Constructs a new instance of the ContractHandler
     * @param {Contract<any>} contract - The contract definition associated with the target class
     */
    constructor(readonly contract: Contract<any>) { }

    assertDemands(self: Record<PropertyKey, unknown>, propertyKey: PropertyKey, ...args: any[]) {
        const demands: Demands<any, any> | Demands<any, any>[] | undefined =
                Reflect.get(this.contract.assertions,propertyKey)?.demands,
            demandsError = `Precondition failed on ${self.constructor.name}.prototype.${String(propertyKey)}`;

        if(!demands || demands.length == 0) {
            return;
        }

        const ds = demands instanceof Array ? demands : [demands as Demands<any,any>];
        assert(ds.every(
            demand => demand.call(self, self, ...args)
        ), demandsError);
    }

    assertEnsures(self: Record<PropertyKey, unknown>, propertyKey: PropertyKey, old: Record<PropertyKey,unknown>, ...args: any[]) {
        const ensures: Ensures<any, any> | Ensures<any, any>[] | undefined =
                Reflect.get(this.contract.assertions,propertyKey)?.ensures,
            ensuresError = `Precondition failed on ${self.constructor.name}.prototype.${String(propertyKey)}`;

        if(!ensures || ensures.length == 0) {
            return;
        }

        const es = ensures instanceof Array ? ensures : [ensures as Ensures<any,any>];
        assert(es.every(
            ensure => ensure.call(self, self, old, ...args)
        ), ensuresError);
    }

    // TODO: ancestors?
    /**
     * Evaluates all registered invariants
     *
     * @param {object} self - The context class
     */
    assertInvariants(self: Record<PropertyKey, unknown>) {
        const iv = this.contract.assertions[invariant];
        if(this.contract.assertions[checkedMode] === false || iv === undefined) { return; }

        const ivs = iv instanceof Array ? iv : [iv as Invariant<any>];
        ivs.forEach(i => assert(i.call(self,self),`Invariant violated. ${i.toString()}`));
    }

    checkedGet(
        target: Record<PropertyKey, unknown>,
        propertyKey: PropertyKey,
        desc: DescriptorWrapper,
        old: any,
        fnRescue: Rescue<any,any>
    ) {
        const doGet = (feature: (...args: any[]) => any, args: any[]) => {
            this.assertInvariants(target);
            this.assertDemands(target, propertyKey, args);
            let result;
            try {
                result = feature.apply(target,args);
                this.assertEnsures(target, propertyKey, old);
            } catch(error) {
                if(fnRescue == null) {
                    throw error;
                }
                let hasRetried = false;
                fnRescue.call(this, this, error, [], () => {
                    hasRetried = true;
                    result = this.checkedGet.call(this, target, propertyKey, desc, old, fnRescue);
                });
                if(!hasRetried) {
                    throw error;
                }
            }
            this.assertInvariants(target);

            return result;
        };

        if(desc.isAccessor) {
            return doGet(desc.descriptor!.get!, []);
        } else if(desc.isMethod) {
            return (...args: any[]): any => doGet(desc.value, args);
        } else if(desc.isProperty) {
            return doGet(() => Reflect.get(target, propertyKey), []);
        } else {
            throw new Error(`Unexpected condition. Unknown feature type. Property: '${String(propertyKey)}'`);
        }
    }

    /**
     * The handler trap for getting property values
     *
     * @param {Record<PropertyKey, unknown>} target - The target object
     * @param {PropertyKey} propertyKey - The name or Symbol  of the property to get
     * @param {Record<PropertyKey, unknown>} _receiver - The proxy or the object inheriting from it
     * @returns {any} - The result of executing 'get' on the target
     */
    get(target: Record<PropertyKey, unknown>, propertyKey: PropertyKey, _receiver: Record<PropertyKey, unknown>) {
        const desc = new DescriptorWrapper(Reflect.getOwnPropertyDescriptor(Object.getPrototypeOf(target),propertyKey)),
            old = Object.entries(target).reduce((acc,[key,value]) => {
                if(typeof value != 'function') {
                    Object.defineProperty(acc,key,{value});
                }

                return acc;
            }, Object.create(null)),
            fnRescue: Rescue<any,any> = Reflect.get(this.contract.assertions,propertyKey)?.rescue;

        return this.checkedGet(target, propertyKey, desc, old, fnRescue);
    }

    checkedSet(
        target: Record<PropertyKey, unknown>,
        propertyKey: PropertyKey,
        value: any,
        desc: DescriptorWrapper,
        old: any,
        fnRescue: Rescue<any,any>
    ) {
        const doSet = (feature: (...args: any[]) => any, args: any[]) => {
            this.assertInvariants(target);
            this.assertDemands(target, propertyKey, args);
            let result;
            try {
                result = feature.apply(target,args);
                this.assertEnsures(target, propertyKey, old);
            } catch(error) {
                if(fnRescue == null) {
                    throw error;
                }
                let hasRetried = false;
                fnRescue.call(this, this, error, [], () => {
                    hasRetried = true;
                    result = this.checkedSet.call(this, target, propertyKey, value, desc, old, fnRescue);
                });
                if(!hasRetried) {
                    throw error;
                }
            }
            this.assertInvariants(target);

            return result;
        };

        if(desc.isAccessor) {
            return doSet(desc.descriptor!.set!, [value]);
        } else if(desc.isMethod) {
            return (...args: any[]): any => doSet(desc.value, args);
        } else if(desc.isProperty) {
            return doSet(() => Reflect.set(target, propertyKey, value), []);
        } else {
            throw new Error(`Unexpected condition. Unknown feature type. Property: '${String(propertyKey)}'`);
        }
    }

    /**
     * The handler trap for setting property values
     *
     * @param {Record<PropertyKey, unknown>} target - The target object
     * @param {PropertyKey} propertyKey - The name or Symbol of the property to set
     * @param {any} value - The new value of the property to set.
     * @returns {boolean} - The result of executing 'set' on the target
     */
    set(target: Record<PropertyKey, unknown>, propertyKey: PropertyKey, value: any): boolean {
        const desc = new DescriptorWrapper(Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target),propertyKey)),
            old = Object.entries(this).reduce((acc,[key,value]) => {
                if(typeof value != 'function') {
                    Object.defineProperty(acc,key,{value});
                }

                return acc;
            }, Object.create(null)),
            fnRescue: Rescue<any,any> = Reflect.get(this.contract.assertions,propertyKey)?.rescue;

        // TODO: prevent replacing a function with a value on proto and vice-versa
        // can instance properties be set as functions?

        return this.checkedSet(target, propertyKey, value, desc, old, fnRescue);
    }
}

export default ContractHandler;