# Changelog

## v0.24.1

* Bugfix of generated type declaration (#238)
* Updated README to reflect current features (#239)
* Updated README to use mermaid diagram

## v0.24.0

* Updated debugger settings to leverage modern VSCode
* Fixed a subtle issue with subcontracting resolution (breaking change) ([#236](https://github.com/final-hill/decorator-contracts/issues/236))
* Updated VSCode debug settings to support the modern IDE
* Updated npm dependencies

## v0.23.1

* Updated dependencies
* Refactored code to leverage new TypeScript features

## v0.23.0

* Fixed bug in README Stack example
* Updated README instructions on webpage installation
* Updated dependencies
* Updated headers for 2022
* Linting fixes
* Added better error messaging for `@override` issues

## v0.22.0

* Added `implies` function
* Added `iff` function
* Added topic tags to github repo
* Updated `package.json` keywords

## v0.21.2

* Audit fix of dependencies
* Updated dependencies
* Upgraded implementation to TypeScript 4.4.4

## v0.21.1

* Audit fix of dependencies
* Updated dependencies
* Upgraded implementation to TypeScript 4.3.5

## v0.21.0

* Audit fix of dependencies
* Updated dependencies
* Added support for contracting an abstract class
* Fixed bug [#210](https://github.com/final-hill/decorator-contracts/issues/210) for supporting subcontract private fields
* Added `within` feature for declaring timing requirements
* Updated documentation
* Third party features are subject to a class's `invariant` when apply/call is used
* A contracted feature can not be applied to objects of a different base class
* Subcontract `extends` are now enforced
* Updated `retry` type declaration to support accessors.

## v0.20.5

* Features named with a symbol now support `@override`

## v0.20.4

* Improved error messaging with `@override` when feature is missing
* Fixed source code typos

## v0.20.3

* Fixed bug [#202](https://github.com/final-hill/decorator-contracts/issues/202)

## v0.20.2

* Additional usability fix for [#197](https://github.com/final-hill/decorator-contracts/issues/197)
* Updated README

## v0.20.1

* Fixed bug [#197](https://github.com/final-hill/decorator-contracts/issues/197)

## v0.20.0

* Updated license headers to reference Final Hill LLC
* BREAKING CHANGE: contracts now managed separate from the class
* Rewrote README to reflect the new architecture
* Updated dependencies
* Merged jest.config.js into package.json
* Updated linting rules
* Moved unit tests to separate folder
* Public property definitions are now illegal
* Fixed package.json debug command
* Bugfix of invariant inheritance

## v0.19.0

* Updated README to include unpkg reference
* Enabled sourcemaps
* npm audit fix
* Updated dependencies
* Linting fixes
* Updated contact info in README and package.json
* BREAKING CHANGE: Decorators now accept arrow functions instead of traditional functions. The first parameter is `self`.
* BREAKING CHANGE: @ensures now provides `old` as a parameter to access instance property values before feature execution

## v0.18.1

* Fixed webpack configuration issue

## v0.18.0

* Fixed missing PredicateType issue
* Reorganized README
* Added NPM badges to README
* Added package.json reference to github issues
* Added licensing info to README
* Removed extraneous build dependency

## v0.17.4

* Additional fixes for Release configuration

## v0.17.3

* Additional fixes for Release configuration

## v0.17.2

* Bugfixed Release Configuration

## v0.17.1

* Updated CI/CD configuration

## v0.17.0

* Migrated repository from Azure Devops to GitHub
* Migrated Azure Devops CI/CD workflows to GitHub actions
* Created CHANGELOG.md and removed related build script
* Replaced `#{YEAR}#` token with literal year. Removed related build script
* Removed VSCode Azure DevOps suggested extensions
* Changed license to AGPL-3.0-only
* Updated repository url to point to GitHub url
* Changed library namespace: `@thenewobjective` -> `@final-hill`
* Updated README Dependencies table
* Updated @rescue documentation
* Replaced build versioning with explicit versioning
* Enabled @rescue inheritance
* Created CONTRIBUTING.md

## v0.16.0

* If an exception is thrown in a class feature without a @rescue defined, then the exception is raised to its caller after the @invariant is checked
* If an error is thrown in @demands, the error is raised to the caller
* If an error is raised in a @ensures then the associated @rescue is executed
* Updated README examples
* Updated implementation to consolidate error messages

## v0.15.0

* Switched from tslint to eslint
* Updated assertions to support assertion types from TypeScript 3.7
* Removed Babel dependency
* Refactoring improvements
* Private properties now work with contract inheritance

## v0.14.0

* Updated YAML scripts to reference new Azure vm image
* Refactored Unit Tests
* Refactored implementation to prefer 'const' declarations
* Refactored README examples
* Refactored RescueType to separate file
* Refactored Rescue Decorator
* @rescue now preserves the invariant after execution
* If a @rescue is executed and the retry argument is not called, then an error is thrown

## v0.13.0

* Automated creation of CHANGELOG.md

## v0.12.0

* Updated dependencies including TypeScript to 3.8.2
* Refactored codebase to utilize new TypeScript features
* Added Introduction to README
* Updated package keywords
* @invariant changed to accept functions directly instead of a record factory
* Multiple @invariant declarations can be assigned to a class

## v0.11.0

* Renamed @requires to @demands
* npm audit fixes
* Multiple @demands can be assigned to a class feature
* Implementation of @ensures decorator
* Reorganized README

## v0.10.0

* Significant refactoring and efficiency improvements
* @requires can not be strengthened in a subtype

## v0.9.0

* Refactoring and efficiency improvements
* @override requires @invariant declaration in class ancestry
* Updated Jest configuration for reporting and VSCode debug support
* Cleanup of documentation
* Added checkMode support to @rescue
* Added Babel compilation
* @requires now works with inheritance

## v0.8.0

* Implementation of @rescue decorator
* Renamed debugMode to checkMode
* Refactoring and efficiency improvements
* @requires restricted to instance class features
* Added linting rule to validate file license header
* Updated TypeScript to 3.7.2

## v0.7.0

* @invariant restricted to only one declaration per class
* @override now supports accessors
* Updated package.json metadata for discoverability
* Added Further Reading section to README

## v0.6.0

* @invariant signature changed to accept a function that returns a record of assertions
* @override restricted to instance class features
* @override extended with additional checks to support Substitutability
* Added linting checks to the project

## v0.5.0

* @override decorator implemented

## v0.4.0

* License changed to AGPL-1.0-only

## v0.3.0

* Table of Contents added to README
* @invariant supports no arguments

## v0.2.0

* Added assertion documentation to README
* Assertions support debugMode flag
* Assertions return a boolean
* Assertions support throwing custom error types

## v0.1.0

* Added installation instructions to README
* Enabled project debugging
* @invariant can accept multiple assertions
* @invariant supports message : assertion pairs
* Ancestor @invariant enforced in subclasses
* Subclasses support additional @invariant declarations
* Added built-types to tasks.json
* Refactoring and typing improvements

## v0.0.2

Updated package.json namespace to @thenewobjective prefix

## v0.0.1

* Initial implementation
* Initial Project Setup
* Initial Branch configuration
* Initial Release configuration
* Build tokenization
* Initial @invariant implementation
* Initial Documentation
