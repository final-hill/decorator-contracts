# Changelog

## v0.17.0

* Migrated repository from Azure Devops to GitHub
* Migrated Azure Devops CI/CD workflows to GitHub actions
* Created CHANGELOG.md and removed related build script
* Replaced `#{YEAR}#` token with literal year. Removed related build script
* Removed VSCode Azure DevOps suggested extensions
* Changed license to AGPL-3.0-only
* Updated repository url to point to GitHub url
* Changed library namespace: `@thenewobjective` -> `@final-hill`

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