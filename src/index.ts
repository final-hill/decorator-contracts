/**
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import Assertion from './Assertion';
import EnsuresDecorator from './EnsuresDecorator';
import InvariantDecorator, { IInvariantDecorator } from './InvariantDecorator';
import OverrideDecorator from './OverrideDecorator';
import RequiresDecorator from './RequiresDecorator';

export default class Contracts implements IInvariantDecorator {
    assert: typeof Assertion.prototype.assert;
    ensures: typeof EnsuresDecorator.prototype.ensures;

    //invariant<Self>(predicate: Predicate<Self>, message?: string | undefined);
    //invariant<Self>(...predicate: Predicate<Self>[]);
    //invariant(predicate?: any, message?: any, ...rest?: any[]) {
    //    throw new Error("Method not implemented.");
    //}
    invariant: typeof InvariantDecorator.prototype.invariant;
    override: typeof OverrideDecorator.prototype.override;
    requires: typeof RequiresDecorator.prototype.requires;

    constructor(protected debugMode: boolean) {
        this.assert = new Assertion(debugMode).assert;
        this.ensures = new EnsuresDecorator(debugMode).ensures;
        this.invariant = new InvariantDecorator(debugMode).invariant;
        this.override = new OverrideDecorator(debugMode).override;
        this.requires = new RequiresDecorator(debugMode).requires;
    }
}