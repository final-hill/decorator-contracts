# Decorator Contracts

[![Build](https://github.com/final-hill/decorator-contracts/workflows/Build/badge.svg?branch=master)](https://github.com/final-hill/decorator-contracts/actions?query=workflow%3ABuild%2FRelease)
[![npm version](https://badge.fury.io/js/%40final-hill%2Fdecorator-contracts.svg)](https://www.npmjs.com/package/@final-hill/decorator-contracts)
[![Downloads](https://img.shields.io/npm/dm/@final-hill/decorator-contracts.svg)](https://www.npmjs.com/package/@final-hill/decorator-contracts)

## Table of Contents

- [Introduction](#introduction)
- [Library Installation](#library-installation)
- [Usage](#usage)
- [Assertions](#assertions)
- [Invariants](#invariants)
- [Overrides](#overrides)
- [Demands](#demands)
- [Ensures](#ensures)
- [Rescue](#rescue)
- [The order of assertions](#the-order-of-assertions)
- [Further Reading](#further-reading)

## Introduction

Decorator Contracts is a library that provides the ability to create and assign
Code Contracts to ECMAScript and TypeScript classes. This enables
enforcement of the
[Liskov substitution principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle)
and the
[Open-closed principle](https://en.wikipedia.org/wiki/Open%E2%80%93closed_principle)
of [SOLID](https://en.wikipedia.org/wiki/SOLID) to support
[Design By Contract™](https://en.wikipedia.org/wiki/Design_by_contract).

Note that the license for this library is [AGPL-3.0-only](https://www.gnu.org/licenses/agpl-3.0.en.html).
You should [know what that means](https://choosealicense.com/licenses/agpl-3.0/) before
using this library. If you would like an exception to this license per section 7
[contact the author](mailto:michael.haufe@final-hill.com).

## Library Installation

As a dependency run the command:

`npm install @final-hill/decorator-contracts`

You can also use a specific [version](https://www.npmjs.com/package/@final-hill/decorator-contracts):

`npm install @final-hill/decorator-contracts@0.19.0`

For use in a webpage:

`<script src="https://unpkg.com/@final-hill/decorator-contracts"></script>`

With a specific [version](https://www.npmjs.com/package/@final-hill/decorator-contracts):

`<script src="https://unpkg.com/@final-hill/decorator-contracts@0.19.0></script>`

## Usage

After installation the library can be imported as such:

```typescript
import Contracts from '@final-hill/decorator-contracts';
```

It is not enough to import the library though, there are two modes of usage:
`checked` and `unchecked`. This is represented as a boolean argument to the
`Contracts` constructor.

checked mode: `true`

unchecked mode: `false`

```typescript
let {assert, invariant, override, rescue, demands, ensures} = new Contracts(true);
```

During development and testing you will want to use checked mode. This will
enable all assertion checks. In production mode all assertion checks become
no-ops for run-time efficiency. As the number of contract definitions can
be numerous, using the appropriate mode becomes increasingly important.

You are not prevented from mixing modes in the event you desire you maintain
a number of checks in a production environment.

## Assertions

Assertions are a fundamental tool for enforcing correctness in an implementation.
They are used inline to express a condition that must evaluate to true at a
particular point of execution.

```typescript
let assert: Contracts['assert'] = new Contracts(true).assert;

function avg(xs: number[]): number {
    assert(xs.length > 0, 'The list can not be empty')

    return xs.reduce((sum, next) => sum + next) / xs.length
}
```

In TypeScript `assert` will also assert the type of the condition:

```typescript
let str: any = 'foo';

str.toUpperCase(); // str is any

assert(typeof str == 'string');

str.toUpperCase(); // str is now a string
```

Due to a [limitation](https://github.com/microsoft/TypeScript/issues/36931) in the current version of TypeScript (3.9),
an explicit type must be assigned to the `assert` as shown above.

In checked mode the assertion is evaluated and throws an exception when its condition is false.
In unchecked mode, assertions always return.

## Invariants

The `@invariant` decorator describes and enforces the semantics of a class
via a provided assertion. This assertion is checked after the associated class
is constructed, before and after every method execution, and before and after
every accessor usage (get/set). If any of these evaluate to false during class
usage, an `AssertionError` will be thrown. Truthy assertions do not throw an
error. An example of this is given below using a Stack:

```typescript
@invariant<Stack<any>>(self => self.size >= 0 && self.size <= self.limit)
@invariant<Stack<any>>(self => self.isEmpty() == (self.size == 0))
@invariant<Stack<any>>(self => self.isFull() == (self.size == self.limit))
class Stack<T> {
    #implementation: T[] = [];

    constructor(readonly limit: number) {}

    clear(): void {
        this.#implementation = [];
    }

    isEmpty(): boolean {
        return this.#implementation.length == 0;
    }

    isFull(): boolean {
        return this.#implementation.length == this.limit;
    }

    pop(): T {
        return this.#implementation.pop()!;
    }

    push(item: T): void {
        this.#implementation.push(item);
    }

    get size(): number {
        return this.#implementation.length;
    }

    top(): T {
        return this.#implementation[this.#implementation.length - 1];
    }
}
```

With the above invariants any attempt to construct an invalid stack will fail:

```typescript
let myStack = new Stack(-1)
```

Additionally, attempting to pop an item from an empty stack would be
nonsensical according to the invariants therefore the following will
throw an `AssertionError` and prevent `pop()` from being executed:

```typescript
let myStack = new Stack(3)
let item = myStack.pop();
```

Whether you have invariants for a class or not it is necessary to use the
decorator anyway on one of the base classes.

```typescript
@invariant
class BaseClass {}

class Subclass extends BaseClass {}
```

This is because the decorators work in relationship to others
in the class hierarchy and the `@invariant` manages this interclass
relationship.

Whether you have invariants for a class or not it is necessary to declare one
anyway on one of the base classes.

## Overrides

Class features implemented in a superclass can be overridden in a subclass. The
subclass implementation can augment or entirely replace the one belonging
to the superclass. This can be done for a variety of reasons, such as
providing a more efficient implementation in the context of the subclass.
Regardless of the reason, the overridden member should be semantically
consistent with the superclass member. In other
words, it should follow [Liskov's Substitution Principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle).
To aid in the enforcement and documentation of this principle the library
provides an `@override` decorator for class methods and accessors.

A simple example is calculating the area of Convex Polygons. While a general
formula exists to accomplish this, more efficient and direct formulas exist
for specific polygons such as a Right Triangle:

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

@invariant
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

This decorator does not only document and verify that the method is
overridden; it will also verify that the parameter count matches.

An `@invariant` decorator must also be defined either on the current class
or on an ancestor. When defined, candidate overrides are identified and an
error is raised if an associated `@override` is missing on that feature.

Static methods, including the constructor, can not be assigned an `@override`
decorator. In the future this may be enabled for non-constructor static methods
but the implications are not clear at present.

## Demands

The `@demands` decorator describes and enforces an assertion that must be true
before its associated feature can execute. In other words before a client
of your class can execute a method or accessor the defined precondition
must first be met or an error will be raised [to the client](#the-order-of-assertions).

```typescript
@invariant
class Stack<T> {
    ...
    @demands<Stack<T>>(self => !self.isEmpty())
    pop(): T {
        return this.#implementation.pop();
    }
}
```

In the above example the precondition of executing `pop`
on a stack is that it is not empty. If this assertion fails
an AssertionError is raised.

An `@invariant` decorator must also be defined either on the current class
or on an ancestor as shown in the example.

Static features, including the constructor, can not be assigned a `@demands`
decorator. In the future this may be enabled for non-constructor static methods
but the implications are not clear at present.

If a class feature is overridden then the `@demands` assertion still applies:

```typescript
class MyStack<T> extends Stack<T> {
    @overrides
    pop(): { ... }
}

...
let myStack = new MyStack()

myStack.pop() // throws
```

If a class feature with an associated `@demands` is overridden, then the new
feature can have a `@demands` declaration of its own. This precondition can
not strengthen the precondition of the original feature. The new precondition
will be or-ed with it's ancestors. If any are true, then the obligation is
considered fulfilled by the user of the feature.

```typescript
@invariant
class Base {
    @demands((_,x: number) => 0 <= x && x <= 10)
    method(x: number) { ... }
}

class Sub extends Base {
    @override
    @demands((_,x: number) => -10 <= x && x <= 20)
    method(x: number) { ... }
}
```

In the above example the precondition of `Sub.prototype.method` is:

`(-10 <= x && x <= 20) || (0 <= x && x <= 10)`

The `_` parameter is a placeholder for the unused self reference.

Multiple `@demands` can be declared for a feature. Doing so will require that
all of these are true before the associated feature will execute:

```typescript
@invariant
class Base {
    @demands((_,x: number) => 0 <= x && x <= 10)
    @demands((_,x: number) => x % 2 == 0)
    method(x: number) { ... }
}

class Sub extends Base {
    @override
    @demands((_,x: number) => -10 <= x && x <= 20)
    @demands((_,x: number) => Number.isInteger(x))
    method(x: number) { ... }
}
```

In the above example the precondition of `Base.prototype.method` is:

`(0 <= x && x <= 10) && (x % 2 == 0)`.

The precondition of `Sub.prototype.method` is:

`(-10 <= x && x <= 20) && Number.isInteger(x) || (0 <= x && x <= 10) && (x % 2 == 0)`

## Ensures

The `@ensures` decorator describes and enforces an assertion that must be true after its associated feature has executed.
In other words after a client of your class has executed a method or accessor the defined postcondition must be met or an
error [will be raised](#the-order-of-assertions).

```typescript
@invariant
class Stack<T> {
    ...
    @ensures<Stack<T>>(self => !self.isEmpty())
    push(value: T) {
         this.#implementation.push(value);
    }
}
```

In the above example the postcondition of executing push on a stack is that it is not empty. If this assertion fails an `AssertionError` is raised.

An `@invariant` decorator must also be defined either on the current class or on an ancestor as shown in the example.

Static features, including the constructor, can not be assigned an `@ensures` decorator. In the future this may be enabled for non-constructor static methods but the implications are not clear at present.

In addition to the `self` argument there is also an `old` argument which provides access to the properties of the instance before its associated member was executed.

```typescript
@invariant
class Stack<T> {
    ...
    @ensures<Stack<T>>((self,old) => self.size == old.size + 1)
    push(value: T) {
         this.#implementation.push(value);
    }

    @ensures<Stack<T>>((self,old) => self.size == old.size - 1)
    pop(): T {
        return this.#implementation.pop();
    }
}
```

Only public properties can be accessed via `old`. This restriction is to prevent infinite recursion through existing assertions.
Also due to a limitation in the current version of JavaScript, decorators are not able to access private properties directly (`#foo`).

If a class feature is overridden then the `@ensures` assertion still applies:

```typescript
class MyStack<T> extends Stack<T> {
    @overrides
    push(value: T): { ... }
}

...
let myStack = new MyStack()

myStack.push()
myStack.isEmpty() == false;
```

The remaining arguments of `@ensures` reflect the arguments of the associated feature.

```typescript
@invariant
class Base {
    @ensures((_self,_old,x: number) => 0 <= x && x <= 10)
    method(x: number) { ... }
}
```

If the class feature with an associated `@ensures` is overridden, then the new feature can have an `@ensures` declaration of its own.
This postcondition can not weaken the postcondition of the original feature. The new postcondition will be and-ed with it's ancestors.
If all are true, then the obligation is considered fulfilled by the user of the feature, otherwise an `AssertionError` is raised.

```typescript
class Sub extends Base {
    @override
    @ensures((_self,_old,x: number) => -10 <= x && x <= 20)
    method(x: number) { ... }
}
```

In the above example the postcondition of Sub.prototype.method is:

`(-10 <= x && x <= 20) && (0 <= x && x <= 10)`

Multiple `@ensures` can be declared for a feature. Doing so will require that all of these are true after the associated feature has executed:

```typescript
@invariant
class Base {
    @ensures((_self,_old,x: number) => 0 <= x && x <= 10)
    @ensures((_self,_old,x: number) => x % 2 == 0)
    method(x: number) { ... }
}

class Sub extends Base {
    @override
    @ensures((_self,_old,x: number) => -10 <= x && x <= 20)
    @ensures((_self,_old,x: number) => Number.isInteger(x))
    method(x: number) { ... }
}
```

In the above example the postcondition of Base.prototype.method is:

`(0 <= x && x <= 10) && (x % 2 == 0)`

The postcondition of Sub.prototype.method is:

`(-10 <= x && x <= 20) && Number.isInteger(x) && (0 <= x && x <= 10) && (x % 2 == 0)`

## Rescue

The `@rescue` decorator enables a mechanism for providing Robustness.
Robustness is the ability of an implementation to respond to situations
not specified; in other words the ability to handle exceptions (pun intended).
This decorator can be assigned to both classes and its non-static features.
The intent of this is to restore any invariants of the class and optionally retry
execution.

```typescript
function popRescue(
    self: Stack<T>,
    error: any,
    args: Parameters<typeof Stack.prototype.pop>,
    retry: (...retryArgs: typeof args) => void
) {
    console.log(error)
}

@invariant
class Stack<T> {
    ...
    @rescue(popRescue)
    pop(): T {
        assert(!this.isEmpty(), 'You can not pop from an empty stack')

        return this.#implementation.pop()!
    }
    ...
}
```

In the above naive example if the `pop` method is called when the stack is
empty an exception occurs. The `@rescue` decorator then intercepts this
exception and handles it by simply logging the error. The exception is
then raised to the caller.

You also have the ability to retry the execution of the decorated
feature from the beginning by calling the `retry` function. This provides
a mechanism for [fault tolerance](https://en.wikipedia.org/wiki/Fault_tolerance).
When retry is called the exception will no longer be raised to the caller.
`retry` can only be called once per exception rescue in order to prevent unbounded
recursion. An example of `retry` usage:

```ts
@invariant
class StudentRepository {
    ...
    @rescue((self, error, [id], retry) => {
        console.error(error)
        console.log('Retrying...')
        retry(id)
    })
    getStudent(id: number): Student {
        const data = fetch(`/repos/students/${id}`).then(response => response.json())

        return new Student(data)
    }
}
```

Only a single `@rescue` can be assigned to a feature. Adding more than one
will raise an error.

The `@rescue` can be defined on an ancestor feature and it will be used if none
is defined on the current class:

```ts
@invariant
class Base {
    ...
    @rescue((self, error, args, retry) => ...)
    myMethod(){ ... }
}

class Sub extends Base {
    @override
    myMethod(){ ... throw new Error('BOOM!') ... }
}
```

Another capability that the `@rescue` decorator provides is
[N-Version programming](https://en.wikipedia.org/wiki/N-version_programming)
to enable [Fault-Tolerance](https://en.wikipedia.org/wiki/Fault_tolerance)
and [Redundancy](https://en.wikipedia.org/wiki/Redundancy_(engineering)).

A dated example of this is performing ajax requests in mult-browser environments where `fetch` may not exist:

```ts
@invariant
class AjaxRequest {
    attempts = 0

    @rescue<AjaxRequest>((self, error, [url], retry) => {
        self.attempts++
        if(self.attempts < 2)
            retry(url)
    })
    get(url){
        if(this.attempts == 0)
            return this.getFetch(url)
        else if(this.attempts == 1)
            return this.getXhr(url)
    }

    getFetch(url) {
        return await fetch(url)
    }

    getXhr(url) {
        return await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url);
            xhr.onload = function() {
                if (this.status >= 200 && this.status < 300) {
                    resolve(xhr.response);
                } else {
                    reject({
                        status: this.status,
                        statusText: xhr.statusText
                    });
                }
            };
            xhr.onerror = function() {
                reject({
                    status: this.status,
                    statusText: xhr.statusText
                });
            };
            xhr.send();
        })
    }
}
```

Unlike `try/catch` where exceptions are non-resumable and handled at a dynamic location,
you can see from the above examples that the `@rescue` mechanism enables resumable exceptions and
"[Organized Panic](https://en.wikipedia.org/wiki/Exception_handling#Exception_handling_based_on_design_by_contract)"
where you can lexically determine where the handling occurs and optionally perform changes and retry the feature call.

An `@invariant` decorator must also be defined either on the current class
or on an ancestor for the `@rescue` to be functional.

## The order of assertions

When `obj.feature` is called the happy path is:

```ts
@invariant -> @demands -> { feature body } -> @ensures -> @invariant
```

If an error is thrown and there is no `@rescue` defined then the `@invariant`
is checked before the error is raised to the caller.

If an error is thrown in the `@invariant` then it is raised to the caller.

If an error is thrown in the `@demands` then the error is raised to the caller.
In this case the `@invariant` is not checked because the feature body has not
been entered and the decorator can not modify the state of the class without
calling another method which is governed by its own contracts.

If an error is thrown by the feature body or the `@ensures` then
the `@rescue` is executed. If `retry` is called then the process
starts from the beginning.

If `@rescue` throws an error or does not call `retry` then the
`@invariant` is checked before the error is raised to the caller.

```ts
        (error) <-----------------+
                    ^ (throws)    | (throws)
                    |             |
obj.feature(...) -> @invariant -> @demands -> { feature body } --+
                    ^                         |                  |
                    |                         | (throws)         |
                    | (retry)                 |                  | (return)
                    +------------ @rescue <---+------+           |
                                  |                  |           |
                                  | (throws|return)  |           |
        (error) <--- @invariant <-+                  |           |
                                                     | (throws)  |
                                                     |           |
       (return) <-- @invariant <---------------- @ensures <------+
```

## Further Reading

- [Design by Contract](https://en.wikipedia.org/wiki/Design_by_contract)
- [Liskov Substitution Principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle)
- [Object-Oriented Software Construction](https://en.wikipedia.org/wiki/Object-Oriented_Software_Construction)
