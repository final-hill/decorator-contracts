/*!
 * @license
 * Copyright (C) 2020 Michael L Haufe
 * SPDX-License-Identifier: AGPL-1.0-only
 */


import Contracts from './';

/**
 * Requirement 194
 * https://dev.azure.com/thenewobjective/decorator-contracts/_workitems/edit/194
 */
describe('The contracts constructor accepts a single boolean parameter called "checkMode"', () => {
    test('Construction', () => {
        expect(new Contracts(true).checkMode).toBe(true);
        expect(new Contracts(false).checkMode).toBe(false);
    });
});