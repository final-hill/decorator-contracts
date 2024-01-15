/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

import { ClassRegistration, classRegistry, ClassType, Feature, takeWhile, assertInvariants } from './lib/index.mjs';
import { assert, checkedMode, Contract, extend } from './index.mjs';
import { Messages } from './Messages.mjs';

const isContracted = Symbol('isContracted'),
    innerContract = Symbol('innerContract');

/**
 * Checks the features of the provided object for properties.
 * If any are found an exception is thrown
 * @param {ClassRegistration} registration - The ClassRegistration for the object
 * @param {U} obj - The object to check
 * @throws {AssertionError} - Throws if a property is found
 * @returns {boolean} - The result of the test
 */
function hasProperties<U>(registration: ClassRegistration, obj: U): boolean {
    return Object.entries(Object.getOwnPropertyDescriptors(obj))
        .some(([key, desc]) => new Feature(registration, key, desc).isProperty);
}

/**
 * Associates a contract with a class via the mixin pattern.
 *
 * @param {Contract} contract The Contract definition
 * @param {T} Base An optional base class
 * @returns {T} The base class for extension
 * @example
 *
 * @Contracted(stackContract)
 * class Stack<T> { ... }
 */
function Contracted<
    T extends Contract<any> = Contract<any>,
    U extends ClassType<any> = ClassType<any>
>(contract: T = new Contract() as T) {
    return function (Clazz: U & { [innerContract]?: Contract<any> }, ctx: ClassDecoratorContext<U>) {
        if (ctx.kind !== 'class')
            throw new TypeError(Messages.MsgNotContracted);

        assert(!Object.getOwnPropertySymbols(Clazz).includes(isContracted), Messages.MsgSingleContract);

        if (contract[checkedMode] === false)
            return Clazz;

        const baseContract = Clazz[innerContract];
        assert(
            !baseContract ||
            baseContract && contract[extend] instanceof baseContract.constructor,
            Messages.MsgBadSubcontract
        );

        abstract class InnerContracted extends Clazz {
            // prevents multiple @Contracted decorators from being applied
            static readonly [isContracted] = true;

            constructor(...args: any[]) {
                super(...args);

                const Class = this.constructor as ClassType<any>,
                    classRegistration = classRegistry.getOrCreate(Class);

                assert(!hasProperties(classRegistration, this), Messages.MsgNoProperties);

                if (!classRegistration.contractsChecked) {
                    // bottom-up to closest Contracted class bind contracts
                    const ancRegistrations = takeWhile(classRegistration.ancestry(), (cr => cr.Class !== Clazz));
                    [classRegistration, ...ancRegistrations, classRegistry.get(Clazz)!].forEach(registration => {
                        registration.bindContract(InnerContracted[innerContract]);
                    });
                }

                assertInvariants(this, InnerContracted[innerContract]);

                return this;
            }

            // FIXME: dirty hack. Possibly resolved by moving to contracts as classes
            // The static getter is used by the construction invariant check
            // The instance getter is used by the feature declarations
            static get [innerContract]() { return contract; }
            get [innerContract]() { return contract; }
        }

        const classRegistration = classRegistry.getOrCreate(InnerContracted);
        classRegistration.contractsChecked = false;

        Object.freeze(Clazz);

        return InnerContracted;
    };
}

export { isContracted, innerContract };
export default Contracted;