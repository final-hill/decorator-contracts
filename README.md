# Introduction

[![Build Status](https://dev.azure.com/thenewobjective/decorator-contracts/_apis/build/status/Build?branchName=master)](https://dev.azure.com/thenewobjective/decorator-contracts/_build/latest?definitionId=11&branchName=master)

[Code Contracts](https://en.wikipedia.org/wiki/Design_by_contract) are 

TODO:

## Library Installation

This library is not published to the [npm registry](https://www.npmjs.com/).
To install this library add the following to your `.npmrc` file:

```text
@thenewobjective:registry=https://pkgs.dev.azure.com/thenewobjective/decorator-contracts/_packaging/public/npm/registry/
always-auth=true
```

Then run the command:

`npm install @thenewobjective/decorator-contracts`

## Usage

After installation the library can be imported as such:

```typescript
import Contracts from '@thenewobjective/decorator-contracts';
```

It is not enough to import the library though, there are two modes of usage:
`debug` and `production`. This is represented as a boolean argument to the
`Contracts` constructor.

debug mode: `true`

production mode: `false`

```typescript
let {assert, invariant} = new Contracts(true);
```

During development and testing you will want to use debug mode. This will
enable all assertion checks. In production mode all assertion checks become
no-ops for run-time efficiency. As the number of contract definitions can
be numerous, using the appropriate mode becomes increasingly important.

You are not prevented from mixing modes in the event you desire you maintain
a number of checks in a production environment.

### Assertions

Assertions are a fundamental tool for enforcing correctness in an implementation.
They are used inline to express a condition that must evaluate to true at a
particular point of execution.

```typescript
let {assert} = new Contracts(true);

function avg(xs: number[]): number {
    assert(xs.length > 0, 'The list can not be empty')

    return xs.reduce((sum, next) => sum + next) / xs.length
}
```

Assertions can also be used with conditionals as they return a boolean value.
So if you find yourself writing code like the following:

```typescript
let {assert} = new Contracts(true);

...

assert(p,'message')
if(p) {
    ...
} else {
    ...
}
```

or:

```typescript
let s: boolean = ...;
assert(q(s), 'message')
do {
    ...
    s = ...;
    assert(q(s), 'message')
} while(q(s))
```

Then you can simplify this as:

```typescript
if(assert(p,'message')) {
    ...
} else {
    ...
}

let s: boolean = ...;
while(assert(q(s), 'message')) {
    ...
    s = ...;
}
```

In debug mode the assertions is evaluated and throws an exception of failure,
otherwise returns true. In production mode, assertions always return true.

### Invariants

The `@invariant` decorator describes and enforces the semantics of a class
via a provided assertion. This assertion is checked after the associated class
is constructed, before and after every method execution, and before and after
every property usage (get/set). If any of these evaluate to false during class
usage, an `AssertionError` will be thrown. Truthy assertions do not throw an
error. An example of this is given below using a Stack:

```typescript
@invariant((self: Stack<any>) => self.size >= 0 && self.size <= self.limit)
@invariant((self: Stack<any>) => self.isEmpty() == (self.size == 0))
@invariant((self: Stack<any>) => self.isFull() == (self.size == self.limit))
class Stack<T> {
    protected _implementation: Array<T> = []

    constructor(readonly limit: number) {}

    isEmpty(): boolean {
        return this._implementation.length == 0
    }

    isFull(): boolean {
        return this._implementation.length == this.limit
    }

    pop(): T {
        return this._implementation.pop()!
    }

    push(item: T): void {
        this._implementation.push(item)
    }

    get size(): number {
        return this._implementation.length
    }

    top(): T {
        return this._implementation[this._implementation.length - 1];
    }
}
```

Custom messaging can be associated with each `@invariant` as well:

```typescript
@invariant((self: Stack<any>) => self.size >= 0 && self.size <= self.limit, "The size of a stack must be between 0 and its limit")
@invariant((self: Stack<any>) => self.isEmpty() == (self.size == 0), "An empty stack must have a size of 0")
@invariant((self: Stack<any>) => self.isFull() == (self.size == self.limit), "A full stack must have a size that equals its limit")
class Stack<T> {
    //...
}
```

Declaring multiple invariants in this style is terribly verbose. A shorthand is also available.

Without messaging:

```typescript
@invariant<Stack<any>>(
    self => self.size >= 0 && self.size <= self.limit,
    self => self.isEmpty() == (self.size == 0),
    self => self.isFull() == (self.size == self.limit)
)
class Stack<T> {
    //...
}
```

With messaging:

```typescript
@invariant<Stack<any>>([
    [self => self.size >= 0 && self.size <= self.limit, "The size of a stack must be between 0 and its limit"],
    [self => self.isEmpty() == (self.size == 0), "An empty stack must have a size of 0"],
    [self => self.isFull() == (self.size == self.limit), "A full stack must have a size that equals its limit"]
])
class Stack<T> {
    //...
}
```

With the above invariants any attempt to construct an invalid stack will fail:

```typescript
let myStack = new Stack(-1)
```

Additionally, attempting to pop an item from an empty stack would be
nonsensical according to the invariants. Therefore the following will
throw an AssertionError and prevent pop() from being executed:

```typescript
let myStack = new Stack(3)
let item = myStack.pop();
```

## Contributing

Due to current licensing restrictions, contributions are not being accepted currently.

## Building/Editing the Project

### Getting Started (FIXME)

- Clone the repository

```batch
git clone --depth=1 ...
```

- Install dependencies

```batch
cd <project_name>
npm install
```

- Build

```batch
npm run build
```

## Project Structure

| Name              | Description                                                                                                   |
|:------------------|:--------------------------------------------------------------------------------------------------------------|
| .cache            | Cache directory generated by [Parcel](https://parceljs.org/)                                                  |
| .vscode           | Settings for VS Code                                                                                          |
| azure             | Build pipeline definitions used by Azure Devops                                                               |
| dist              | Contains the compiled output of the build                                                                     |
| docs              | Library documentation                                                                                         |
| node_modules      | node package dependencies                                                                                     |
| src               | Contains the source code that will be compiled to the `dist` dir                                              |
| .editorconfig     | Config settings for [EditorConfig](https://editorconfig.org/) IDE code style checking                         |
| .gitignore        | Specifies files untracked by version control                                                                  |
| .npmrc            | npm config settings                                                                                           |
| LICENSE           | GNU General Public License v2.0 only                                                                          |
| package-lock.json | Autogenerated [meta-manifest](https://docs.npmjs.com/files/package-lock.json) of package.json                 |
| package.json      | [Node Package configuration](https://docs.npmjs.com/files/package.json) settings with related build scripts   |
| README.md         | The current file. A high level overview of the library                                                        |
| tsconfig.json     | Config settings for compiling TypeScript code                                                                 |
| tslint.json       | Config settings for TSLint code style checking                                                                |

## Build and Test

To build and test this library locally you will need the following:

- [VS Code](https://code.visualstudio.com/)

  - Install the recommended extensions

- A [active](https://github.com/nodejs/Release) version of [Node.js](https://nodejs.org/en/)
  - With a corresponding [npm installation](https://www.npmjs.com/get-npm)

| Npm Script    | Description |
|:--------------|:------------|
| `build`       | Performs a full build of the library including type generation and linting. Outputs to the `dist` folder |
| `build-types` | Generates type definitions for the library in the `dist` folder                                          |
| `clean`       | deletes the `dist` folder                                                                                |
| `clean-full`  | deletes the `dist`, `node_modules`,  and `.cache` folders                                                |
| `debug`       | Starts debugger                                                                                          |
| `lint`        | Performs linting and type checking of the library                                                        |
| `test`        | Executes unit tests                                                                                      |
| `type-check`  | Performs type checking                                                                                   |

## Dependencies

Dependencies are managed through `package.json`. There are no runtime dependencies.
The development dependencies are as follows:

| Package          | Description                                           |
|:-----------------|:------------------------------------------------------|
| `@types/jest`    | Type Definitions for `ts-jest` support                |
| `jest`           | JavaScript Unit testing library                       |
| `parcel-bundler` | Web Application bundler                               |
| `rimraf`         | OS-Agnostic remove command for deleting files/folders |
| `ts-jest`        | TypeScript support for `jest`                         |
| `tslint`         | TypeScript linting library                            |
| `typescript`     | TypeScript compiler                                   |
