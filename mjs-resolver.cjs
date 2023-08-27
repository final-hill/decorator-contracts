/*!
 * @license
 * Copyright (C) 2023 Final Hill LLC
 * SPDX-License-Identifier: AGPL-3.0-only
 * @see <https://spdx.org/licenses/AGPL-3.0-only.html>
 */

module.exports = (path, options) => {
    const mjsExtRegex = /\.mjs$/i,
        resolver = options.defaultResolver;
    if (mjsExtRegex.test(path))
        try {
            return resolver(path.replace(mjsExtRegex, '.mts'), options);
        } catch {
            // use default resolver
        }


    return resolver(path, options);
};