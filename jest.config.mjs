/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
    preset: 'ts-jest/presets/default-esm',
    moduleFileExtensions: [
        'mts',
        'mjs',
        'js'
    ],
    moduleNameMapper: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        '^(\\.{1,2}/.*)\\.mjs$': '$1',
    },
    testMatch: [
        '<rootDir>/src/**/*.test.mts'
    ],
    transform: {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        '^.+\\.mts$': [
            'ts-jest', {
                useESM: true
            }
        ]
    },
    coverageProvider: 'v8',
    collectCoverage: true,
    collectCoverageFrom: [
        '<rootDir>/src/**/*.mts'
    ],
    coverageDirectory: './coverage',
    testEnvironment: 'node',
    resolver: '<rootDir>/mjs-resolver.cjs',
    reporters: [
        'default',
        [
            'jest-junit',
            {
                outputDirectory: './coverage'
            }
        ]
    ]
};