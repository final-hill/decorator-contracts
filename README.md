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

### Overrides

Methods implemented in a superclass can be overridden in a subclass. The
subclass implementation can augment or entirely replace the one belonging
to the superclass. This can be done for a variety of reasons, such as
providing a more efficient implementation in the context of the subclass.
Regardless of the reason, the overridden method should be semantically
consistent with the superclass method. In other words, it should follow
[Liskov's Substitution Principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle).
To aid in the enforcement and documentation of this principle the library
provides an `@override` decorator for class methods.

A simple example is calculating the area of Convex Polygons. While a general
formula exists to accomplish this, more efficient and direct formulas exist
for specific polygons such as a Right Triangles:

```typescript
type Side = number
type Vertex = [number, number]

let _triArea = (v1: Vertex, v2: Vertex, v3: Vertex): number => {
    let a = Math.hypot((v1[0] - v2[0]), (v1[1] - v2[1])),
        b = Math.hypot((v2[0] - v3[0]), (v2[1] - v3[1])),
        c = Math.hypot((v3[0] - v1[0]), (v3[1] - v1[1])),
        s = 0.5 * (a + b + c)

    return Math.sqrt(s*(s-a)*(s-b)*(s-c))
}

class ConvexShape {
    readonly vertices: Vertex[]

    constructor(...vertices: Vertex[]) {
        this.vertices = vertices
    }

    area(): number {
        let [v1, v2, v3, ...vs] = this.vertices
        return this.vertices.length >= 3 ?
            _triArea(v1, v2, v3) + new ConvexShape(v1, v3, ...vs).area() :
            0
    }
}

class RightTriangle extends ConvexShape {
    constructor(
        readonly base: Side,
        readonly height: Side
    ) {
        super([0,0], [base,0], [base,height])
    }

    @override
    area(): number {
        return this.base * this.height / 2
    }
}
```

Above you can see the `area()` method being overridden with the more
efficient implementation. The `@override` decorator makes explicit
that the method is replacing another implementation.

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
