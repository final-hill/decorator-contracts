/**
 * @license
 * Copyright (C) 2019 Michael L Haufe
 * SPDX-License-Identifier: GPL-2.0-only
 */

import Assertion from './Assertion';
import EnsuresDecorator from './EnsuresDecorator';
import RequiresDecorator from './RequiresDecorator';
import OverrideDecorator from './OverrideDecorator';

export default class Contracts {
    assert: typeof Assertion.prototype.assert;
    ensures: typeof EnsuresDecorator.prototype.ensures;
    requires: typeof RequiresDecorator.prototype.requires;
    override: typeof OverrideDecorator.prototype.override;

    constructor(protected debugMode: boolean) {
        this.assert = new Assertion(debugMode).assert;
        this.ensures = new EnsuresDecorator(debugMode).ensures;
        this.requires = new RequiresDecorator(debugMode).requires;
        this.override = new OverrideDecorator(debugMode).override;
    }
}