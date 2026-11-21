# Decorator Contracts

[![Build](https://github.com/final-hill/decorator-contracts/workflows/Build/badge.svg?branch=master)](https://github.com/final-hill/decorator-contracts/actions?query=workflow%3ABuild%2FRelease)
[![npm version](https://badge.fury.io/js/%40final-hill%2Fdecorator-contracts.svg)](https://www.npmjs.com/package/@final-hill/decorator-contracts)
[![Downloads](https://img.shields.io/npm/dm/@final-hill/decorator-contracts.svg)](https://www.npmjs.com/package/@final-hill/decorator-contracts)

## Table of Contents

- [Introduction](#introduction)
- [Library Installation](#library-installation)
- [Usage](#usage)
- [Checked Mode](#checked-mode)
- [Assertions](#assertions)
- [Implies](#implies)
- [Iff](#iff)
- [Contracts are Hoare triples](#contracts-are-hoare-triples)
- [Encapsulation](#encapsulation)
- [Invariants](#invariants)
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
of [SOLID](https://en.wikipedia.org/wiki/SOLID)
and [Organized Panic](https://en.wikipedia.org/wiki/Exception_handling#Exception_handling_based_on_design_by_contract) to support
[Design By Contract™](https://en.wikipedia.org/wiki/Design_by_contract).

Note that the license for this library is [AGPL-3.0-only](https://www.gnu.org/licenses/agpl-3.0.en.html).
You should [know what that means](https://choosealicense.com/licenses/agpl-3.0/) before
using this. If you would like an exception to this license per section 7
[contact the author](mailto:michael.haufe@final-hill.com).

## Library Installation

The latest version:

`npm install @final-hill/decorator-contracts`

A specific version:

`npm install @final-hill/decorator-contracts@x.x.x`

For use in a browser (no build step) via [unpkg.com](https://unpkg.com/):

```html
<script type="importmap">
{
    "imports": {
        "@final-hill/decorator-contracts": "https://unpkg.com/@final-hill/decorator-contracts"
    }
}
</script>
```

Via [skypack.dev](https://www.skypack.dev/):

`<script type="module" src="https://cdn.skypack.dev/@final-hill/decorator-contracts"></script>`

## Usage

After installation, use the decorators directly on your class methods and properties. All contracted classes must extend `Contracted` and be instantiated using the static `.new()` method.

```typescript
import { Contracted, invariant, demands, ensures } from '@final-hill/decorator-contracts';

@invariant((self: Stack<any>) =>
    self.isEmpty() == (self.size == 0) &&
    self.isFull() == (self.size == self.limit) &&
    self.size >= 0 && self.size <= self.limit
)
class Stack<T> extends Contracted {
    private _implementation: T[] = [];
    private _size = 0;
    private _limit: number;

    constructor(limit: number) {
        super();
        this._limit = limit;
    }

    get limit() { return this._limit; }
    get size() { return this._size; }

    clear(): void {
        this._implementation = [];
        this._size = 0;
    }

    isEmpty(): boolean { return this._implementation.length == 0; }
    isFull(): boolean { return this._implementation.length == this.limit; }

    @demands((self: Stack<any>) => !self.isEmpty())
    @ensures((self: Stack<any>, _args, old: Stack<any>) =>
        !self.isFull() && self.size == old.size - 1)
    pop(): T {
        this._size--;
        return this._implementation.pop()!;
    }

    @demands((self: Stack<any>) => !self.isFull())
    @ensures((self, [item], old: Stack<any>) =>
        !self.isEmpty() &&
        self.top === item &&
        self.size === old.size + 1
    )
    push(item: T): void {
        this._size++;
        this._implementation.push(item);
    }

    get top(): T | undefined {
        return this._implementation.at(-1);
    }
}

const stack = Stack.new(3);
stack.push(1);
stack.push(2);
stack.pop();
```

## Instantiation: Using the Static `.new(...)` Method

Because this library uses JavaScript `Proxy` to enforce contracts, you **must** instantiate all classes that extend `Contracted` using the static `.new(...)` method (not with `new MyClass(...)`).

This is required so that the instance is wrapped in a Proxy and invariants are asserted immediately after construction. Direct use of the `new` keyword will throw an error.

## Checked Mode

Checked Mode controls whether contract checking (invariants, demands, ensures, and rescue) is enabled or disabled at runtime. This feature allows you to turn off contract enforcement in production environments for maximum performance, while keeping it enabled during development and testing to catch bugs and contract violations early.

Checked Mode is a coarse switch over the whole library, not a re-entrancy mechanism. When it is disabled, contract evaluation is skipped entirely and external encapsulation is not enforced either, so an instance behaves like a plain object.

By default, Checked Mode is enabled. You can control it via the static `[checkedMode]` symbol property of Contracted:

```typescript
Contracted[checkedMode] = false; // Disable Checked Mode
```

One approach to managing this is to leverage environment variables. For example, you can interrogate `NODE_ENV` to determine whether to enable or disable Checked Mode:

```typescript
Contracted[checkedMode] = process.env.NODE_ENV === 'development'
```

## Assertions

Use the `assert` function for inline assertions:

```typescript
import { assert } from '@final-hill/decorator-contracts';

function avg(xs: number[]): number {
    assert(xs.length > 0, 'The list can not be empty');
    return xs.reduce((sum, next) => sum + next) / xs.length;
}
```

If you are using TypeScript, `assert` will also assert the type of the condition:

```typescript
let str: any = 'foo';

str.toUpperCase(); // str is any

assert(typeof str == 'string');

str.toUpperCase(); // str is now a string
```

**`assert` should not be used for validating arguments**

Use the `@demands` decorator for this purpose.

## Implies

When defining predicates it is a common use case to encode [material implication](https://en.wikipedia.org/wiki/Material_conditional):

```typescript
import { implies } from '@final-hill/decorator-contracts';

implies(weather.isSunny, person.visitsBeach);
// Equivalent to: !weather.isSunny || person.visitsBeach
```

## Iff

When defining predicates it is a common use case to encode [if and only if](https://en.wikipedia.org/wiki/Logical_biconditional):

```typescript
import { iff } from '@final-hill/decorator-contracts';

iff(person.hasTicket, person.ridesTrain);
// Equivalent to: implies(p, q) && implies(q, p)
```

## Contracts are Hoare triples

A contract describes the **observable boundary** of a feature, in the sense of a [Hoare triple](https://en.wikipedia.org/wiki/Hoare_logic):

$$\{P\}\; C\; \{Q\}$$

`@demands` is $P$, `@ensures` is $Q$, and the feature body is $C$. Nothing inside $C$ is constrained: a body may assign to its own properties, including public ones, and may call its own features without re-entering the contracts. Correctness is the obligation that $P$ and $Q$ hold at the boundary, with the invariant additionally holding on entry and exit.

This is why there is no need to police what a body does to itself. If a body leaves the object in an invalid state, `@invariant` rejects it on exit. If it produces the wrong result, `@ensures` rejects it. Attempting to enforce correctness *inside* $C$ as well would mean the same guarantee twice, at the cost of forbidding legitimate intermediate states.

## Encapsulation

Encapsulation governs the **external surface**. Public property assignment is forbidden from outside a contracted class, so a caller cannot mutate state without a postcondition to catch it. All interactions must go through a method or getter/setter, and only properties starting with `_` (conventionally private) can be assigned to after construction.

```typescript
class Example extends Contracted {
    _private = 1; // Allowed
    publicProp = 2; // Not allowed from outside
}
```

An external write to a public property raises a `TypeError`:

```typescript
const example = Example.new();

example.publicProp = 3; // TypeError
```

A feature body is $C$ and is **not** subject to this rule. It runs against the instance directly, so internal state — public or private — is its own business:

```typescript
class Example extends Contracted {
    publicProp = 1;

    update(): void {
        this.publicProp = 2; // allowed; `@ensures` and `@invariant` are the guarantee
    }
}
```

A method calling another method of the same instance likewise does not start a second contract lifecycle. The enclosing invocation owns the assertions, so the invariant is evaluated once on entry and once on exit regardless of how many internal accesses the body performs.

One consequence: a body that leaks `this` outward — passing it to a callback, storing it in a module-level variable, or returning it — hands out a reference that bypasses the traps. Do not do that; expose an explicit API instead.

`Object.defineProperty` and `Reflect.defineProperty` operate below the proxy and are not intercepted.

## Note on Private Fields and Accessors

Due to the use of JavaScript `Proxy` in the implementation of this library, native `#private` fields and the `accessor` keyword are **not supported**. Instead, use conventional private fields (e.g., `_private`) and define explicit getter/setter pairs for encapsulation:

```typescript
class Example extends Contracted {
    private _value = 0;
    get value() { return this._value; }
    set value(v: number) { this._value = v; }
}
```

Do **not** use:

- `#privateField` syntax
- `accessor foo` syntax

These will not work correctly with the contract enforcement provided by this library.

## Invariants

Use the `@invariant` decorator on your class to enforce relationships between properties and methods. The invariant is checked after construction, before and after every method execution, and before and after every get/set usage.

```typescript
@invariant(self => self.value >= 0)
class Foo extends Contracted {
    protected _value = 0;
    get value() { return this._value; }
    set value(v: number) { this._value = v; }

    inc(): void { this.value++; }
    dec(): void { this.value--; }
}
```

### Contract predicates must return a boolean

`@invariant`, `@demands`, and `@ensures` predicates must return `true` or `false`. The result is not coerced: a non-boolean result raises an `AssertionError` naming the contract, the feature, and which predicate in the composition failed.

```typescript
@demands(() => Promise.resolve(true))  // AssertionError: returned a Promise
```

This is deliberate. A `Promise` is always truthy, so coercing the result would silently treat an accidentally asynchronous predicate — one that has not actually checked anything yet — as a satisfied contract. Failing closed is the only safe option, and the message points at the mistake.

This also means asynchronous validation is not supported yet; see the note on asynchronous contracts.

### Subcontracting and Invariants

When subclassing, if a subclass defines its own `@invariant`, the resulting invariant is **strengthened**: the subclass invariant and the base class invariant are both enforced (they are logically AND-ed together). This means all invariants in the inheritance chain must hold for the object to be valid.

```typescript
@invariant(self => self.value >= 0)
class Base extends Contracted {
    // ...
}

@invariant(self => self.value <= 10)
class Sub extends Base {
    // ...
}
// The effective invariant for Sub is: (self.value >= 0) && (self.value <= 10)
```

## Demands

Use the `@demands` decorator to specify preconditions for methods or get/set. If the condition fails, an error is thrown before the method executes.

```typescript
class Foo extends Contracted {
    protected _value = 0;
    get value() { return this._value; }
    set value(v: number) { this._value = v; }

    @demands(self => self.value >= 0)
    dec(): void { this.value--; }
}
```

### Subcontracting and Demands

When subclassing, if a subclass defines its own `@demands` for a method, the resulting precondition is **weakened**: the subclass and base class demands are OR-ed together. The method can be called if **any** of the demands in the inheritance chain are satisfied.

```typescript
class Base extends Contracted {
    @demands((_self, x: number) => x >= 0)
    foo(x: number) { /* ... */ }
}

class Sub extends Base {
    @demands((_self, x: number) => x === 42)
    override foo(x: number) { /* ... */ }
}
// The effective demand for Sub#foo is: (x >= 0) || (x === 42)
```

## Ensures

Use the `@ensures` decorator to specify postconditions for methods or get/set. If the condition fails, an error is thrown after the method executes.

```typescript
class Foo extends Contracted {
    protected _value = 0;
    get value() { return this._value; }
    set value(v: number) { this._value = v; }

    @ensures(self => self.value >= 0)
    dec(): void { this.value--; }
}
```

### The `old` instance

A postcondition receives `old`, a snapshot of the instance taken immediately before the feature ran. `old` inherits from the instance, so prototype getters and methods remain usable, and reading a prototype getter on `old` returns the historical value:

```typescript
class Counter extends Contracted {
    protected _n = 0;
    get n() { return this._n; }

    @ensures((self, _args, old) => self.n === old.n + 1)
    inc(): void { this._n++; }
}
```

Own state is copied, so mutations made by the feature body are not visible through `old`. The copy is deep for the containers contracts routinely compare:

| Value | Behaviour in `old` |
| --- | --- |
| Primitives | copied |
| Arrays | cloned recursively |
| `Date` | cloned |
| `Map`, `Set` | cloned (keys and values recursively) |
| Plain objects | cloned recursively, including cycles |
| Class instances | **shared by reference** |
| Functions | **shared by reference** |

Class instances and functions are shared deliberately. They carry behaviour, so a structural copy would produce an object that is not a real instance of its class, and many cannot be cloned meaningfully at all. The consequence is that mutating a class instance held in a field *is* visible through `old`; if a postcondition depends on such an object's previous state, copy it explicitly in the predicate.

Accessors are copied as descriptors rather than evaluated, so snapshotting never invokes a getter.

### Subcontracting and Ensures

When subclassing, if a subclass defines its own `@ensures` for a method, the resulting postcondition is **strengthened**: the subclass and base class ensures are AND-ed together. The method's result must satisfy **all** ensures in the inheritance chain.

```typescript
class Base extends Contracted {
    @ensures((_self, _args, x: number) => x >= 0)
    foo(x: number) { /* ... */ }
}

class Sub extends Base {
    @ensures((_self, _args, x: number) => x <= 10)
    override foo(x: number) { /* ... */ }
}
// The effective ensures for Sub#foo is: (x >= 0) && (x <= 10)
```

## Rescue

Use the `@rescue` decorator to handle exceptions thrown by a method, restore invariants, or retry execution:

```typescript
import { rescue } from '@final-hill/decorator-contracts';

class Example extends Contracted {
    private _value = 3;
    get value() { return this._value; }
    set value(v) { this._value = v; }

    @rescue(self => self.value = 5)
    method1(): void { throw new Error('I am error'); }
}
```

You can also use the `retry` function in your rescue handler to attempt the method again:

```typescript
class Example extends Contracted {
    @rescue((_self, _error, _args, retry) => retry(3))
    method(value: number): number {
        if (value <= 0)
            throw new Error('value must be greater than 0');
        else
            return value;
    }
}
```

`retry` passes **only** the arguments you give it — it does not replay the original arguments. To retry with the same arguments, forward the `args` you received:

```typescript
@rescue((_self, _error, args, retry) => retry(...args))
```

Calling `retry()` retries with no arguments.

### Robustness, Organized Panic, and the Benefits of `@rescue`

The `@rescue` decorator enables a mechanism for **Robustness** in your code. It allows your implementation to respond to situations not specified, providing the ability to handle exceptions in a structured way. This is sometimes called **Organized Panic**.

In addition, `@rescue` provides a foundation for **N-Version programming**, **Fault-Tolerance**, and **Redundancy**. You can implement multiple strategies for handling errors, retrying with alternative logic or data, and ensuring your application can recover from unexpected failures.

A retried invocation re-enters the full assertion lifecycle (`@invariant` -> `@demands` -> body -> `@ensures`), and if it fails again the `@rescue` handler runs again. This means the handler is executed once per attempt, which is what N-Version programming requires: each invocation of the handler can select the next alternative.

A dated example of this is performing ajax requests in a multi-browser environment:

```typescript
class AjaxRequest extends Contracted {
    private _version = 0;
    private _versions = ['legacy', 'activex', 'xhr'] as const;

    @rescue((self: AjaxRequest, _error, args, retry) => {
        self._version++;
        retry(...args);
    }, { maxRetries: 2 })
    get(url: string): string {
        const version = this._versions[this._version];

        switch (version) {
            case 'legacy':
                if (!window.XMLHttpRequest) throw new Error(`${version} unsupported`);
                return legacyGet(url);
            case 'activex':
                if (!window.ActiveXObject) throw new Error(`${version} unsupported`);
                return activeXGet(url);
            default:
                return xhrGet(url);
        }
    }
}
```

Because a rescue handler may retry unconditionally, retries are unbounded by default. Set the `maxRetries` option on the `@rescue` declaration to bound them; when the limit is reached the last error is raised to the caller:

```typescript
@rescue((_self, _error, args, retry) => retry(...args), { maxRetries: 3 })
```

The option belongs to the declaration because the number of alternatives is a property of the feature, not of an individual failure. It is enforced per invocation of the feature, so a single call performs at most `maxRetries` retries however many `@rescue` executions that involves.

Unlike traditional `try/catch`, where exceptions are non-resumable and often handled far from the source (leading to scattered and redundant error handling), `@rescue` allows for **resumable exceptions** and localized, declarative error handling. This means:

- You can lexically determine where exception handling occurs.
- You can restore invariants or perform corrective actions before retrying or failing.
- You can optionally call `retry` to attempt the method again with new arguments or after fixing state, providing a form of fault tolerance and robustness.
- You can implement alternative strategies for error recovery, supporting N-Version programming and redundancy.

**Inheritance:**

If a base class declares a `@rescue` handler for a method, that handler is inherited by subclasses unless the subclass overrides it with its own `@rescue` declaration. This ensures that robust error handling is preserved throughout the inheritance chain, unless explicitly changed.

This approach leads to more maintainable and robust code, as error handling is organized and closely tied to the contract of the class feature, rather than being scattered throughout the call stack.

## The order of assertions

When `obj.feature` is called the happy path is:

![image](./docs/happy-path.png)

The invariant is evaluated **twice** per successful call: once on entry and once on exit. Each of `@demands`, the feature body, and `@ensures` runs once. Accessors follow the same lifecycle as methods, and an accessor that reads another accessor or calls a method does not start a nested lifecycle.

The entry check is not redundant with `Contracted.new()`. Object state can be corrupted without going through a checked feature — via `Object.defineProperty`, by running with checked mode disabled and re-enabling it, or internally from a feature body. The entry check is what turns that into a precise error at the next public interaction rather than letting an invalid object keep operating.

Because the invariant is checked first, an invalid object reports its invariant violation rather than a precondition failure. That ordering is deliberate: the object is broken in a way that makes the caller's arguments moot.

If an error is thrown and there is no `@rescue` defined then the `@invariant` is checked before the error is raised to the caller.

If an error is thrown in the `@invariant` then it is raised to the caller.

If an error is thrown in the `@demands` then the error is raised to the caller. In this case the exit `@invariant` is not checked because the feature body has not been entered and the instance cannot have changed.

If an error is thrown by the feature body or the `@ensures` then the `@rescue` is executed. If `retry` is called then the process starts from the beginning.

If the retried invocation fails, its `@rescue` is executed again, so the handler runs once per attempt. Retries are bounded by the `maxRetries` option; without it they are unbounded.

If `@rescue` throws an error or does not call `retry` then the `@invariant` is checked before the error is raised to the caller.

![image](./docs/order-of-assertions.png)

## Further Reading

- [Design by Contract](https://en.wikipedia.org/wiki/Design_by_contract)
- [Liskov Substitution Principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle)
- [Object-Oriented Software Construction](https://en.wikipedia.org/wiki/Object-Oriented_Software_Construction)
