/**
 * @license
 * Copyright (C) __YEAR__ Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import Assertion from './Assertion';
import EnsuresDecorator from './EnsuresDecorator';
import InvariantDecorator from './InvariantDecorator';
import OverrideDecorator from './OverrideDecorator';
import RequiresDecorator from './RequiresDecorator';

export default class Contracts {
    assert: typeof Assertion.prototype.assert;
    ensures: typeof EnsuresDecorator.prototype.ensures;
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