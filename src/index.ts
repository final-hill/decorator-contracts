/*!
 * @license
 * Copyright (C) #{YEAR}# Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */

import Assertion from './Assertion';
import EnsuresDecorator from './EnsuresDecorator';
import InvariantDecorator from './InvariantDecorator';
import OverrideDecorator from './OverrideDecorator';
import RequiresDecorator from './RequiresDecorator';
import RescueDecorator from './RescueDecorator';

/**
 * The Contracts class defines methods that can be used to define and enforce
 * specifications for other classes. These are exposed as decorator factories and
 * an assertion function.
 */
class Contracts {
    assert: typeof Assertion.prototype.assert;
    ensures: typeof EnsuresDecorator.prototype.ensures;
    invariant: typeof InvariantDecorator.prototype.invariant;
    override: typeof OverrideDecorator.prototype.override;
    requires: typeof RequiresDecorator.prototype.requires;
    rescue: typeof RescueDecorator.prototype.rescue;

    /**
     * Constructs a new instance of Contracts in the specified mode
     *
     * @param checkMode - enables assertions
     */
    constructor(readonly checkMode: boolean) {
        this.assert = new Assertion(checkMode).assert;
        this.ensures = new EnsuresDecorator(checkMode).ensures;
        this.invariant = new InvariantDecorator(checkMode).invariant;
        this.override = new OverrideDecorator(checkMode).override;
        this.requires = new RequiresDecorator(checkMode).requires;
        this.rescue = new RescueDecorator(checkMode).rescue;
    }
}

export default Contracts;