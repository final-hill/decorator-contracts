# Testing a contracted class

A contracted class is a `Contracted` subclass under any test runner. What changes is
what a test has to *own*: `@invariant` is the fixture's validity check, `@demands` is
what an arrange block would otherwise establish, and `@ensures` is what an assertion
would otherwise restate. A test that supplies what the declarations do not is a
scenario; a test that repeats a declaration is a second copy that will drift.

The examples below run against the built package with `node:test` and
`node:assert/strict`. Nothing here needs a runner feature or a library change.

A fence that shows only the declarations under discussion is an excerpt. A fence that
claims to run is a complete example, and the classes it references are defined in it or
in the section above it.

- [The three roles](#the-three-roles)
- [Arrange](#arrange)
- [The destructuring trap](#the-destructuring-trap)
- [Assert](#assert)
- [Mocking](#mocking)
- [Async](#async)
- [Enumerating the contracts](#enumerating-the-contracts)
- [Generating inputs](#generating-inputs)

## The three roles

| Role | Shape | What it is |
| --- | --- | --- |
| **Requirements class** | A `Contracted` subclass whose members declare `@invariant`, `@demands`, and `@ensures`, and no sequence. | The specification. |
| **Specification driver** | A `Contracted` class with no state of its own whose features take the objects they relate as arguments. | The properties one class cannot state alone. |
| **Scenario** | A test that supplies the inputs and shows the behaviour. | An example that validates the specification. |

A driver is where a cross-object law belongs. *A patron cannot hold a book that is
already held* is a property of the pair, so it can be neither book's invariant nor its
precondition. The driver states it once, and every scenario that goes through the
driver is checked against it:

```typescript
import { Contracted, demands, ensures, invariant } from '@final-hill/decorator-contracts';

@invariant(({ self }) => !self._onHold || self._holder === undefined)
class Book extends Contracted {
    public _onHold = false;
    public _holder?: string;

    get onHold() { return this._onHold; }
    get holder() { return this._holder; }

    @demands(({ self }) => !self.onHold && self.holder === undefined)
    @ensures(({ self }) => self.onHold && self.holder === undefined)
    placeHold(_patron: string): void { this._onHold = true; }

    @demands(({ self }) => self.onHold)
    @ensures(({ self }) => !self.onHold)
    release(): void { this._onHold = false; }

    @demands(({ self, args: [patron] }) => self.onHold && self.holder !== patron)
    @ensures(({ self, args: [patron] }) => self.holder === patron)
    checkout(patron: string): void { this._onHold = false; this._holder = patron; }
}

class Usage extends Contracted {
    @demands(({ args: [book] }) => !book.onHold)
    @ensures(({ args: [book], oldArgs: [before] }) => book.onHold && !before.onHold)
    holdFor(book: Book, patron: string): void { book.placeHold(patron); }
}
```

`oldArgs` is what makes the second half of that postcondition expressible. `book` is an
argument, not `self`, so `old` says nothing about it; and `old` shares a class instance
by reference, so `book.onHold && !old.…` would compare a book to itself.

## Arrange

There is no `setUp` and no fixture object. The instance *is* the fixture and
`@invariant` is its validity check, asserted on entry and exit of every call. Four ways
to reach a starting state, in order of preference:

| Approach | Use when |
| --- | --- |
| Call the public features | almost always — the sequence is the scenario |
| Assign a `_`-prefixed field | the state cannot be reached through the API, and the name rule permits it |
| `[encapsulationMode] = false` on a class | the double wants plain-object behaviour but you still want the checks |
| `[checkedMode] = false` | you are testing what happens to an already-invalid object |

A write to a **public** property is a `TypeError`, by design, so a `beforeEach` that
assigns `instance.value = …` does not port. Assign `_value`, or add the feature that
legitimately reaches that state — the second is usually the better signal about the
design.

## The destructuring trap

A predicate that reads instance state must bind `self`. It is the field a contract
hands over, not a parameter, so a predicate that forgets it reads an undeclared name:

```typescript
@demands(({ self, args: [amount] }) => amount <= self._balance)   // correct
@demands(({ args: [amount] }) => amount <= self._balance)         // ReferenceError: self is not defined
```

The second is not a contract failure, so it surfaces as a `ReferenceError` from inside
the trap rather than an `AssertionError`. It is the most common way a first contract is
written wrong, and the compiler reports it unhelpfully because the default lib already
declares `self`:

| Project lib | Diagnostic |
| --- | --- |
| `ES2024` only (Node) | `TS2304: Cannot find name 'self'` |
| default (includes DOM) | `TS2339: Property '_balance' does not exist on type 'Window & typeof globalThis'` |

The second is the one a client meets, because the default lib declares `self` as the
browser global, so the arrow compiles against `Window` and the error names a property
rather than the missing destructuring. Both do stop the build, so this is a diagnostic
quality problem rather than a correctness problem.

## Assert

A failed contract throws an `AssertionError` carrying a `violation`. Four shapes cover
almost every assertion:

```typescript
import nodeAssert from 'node:assert/strict';
import {
    AssertionError, Contracted, demands, ensures, invariant, type ContractViolation,
} from '@final-hill/decorator-contracts';

const violationOf = (fn: () => unknown): ContractViolation => {
    try { fn(); } catch (error) {
        nodeAssert.ok(error instanceof AssertionError, `expected AssertionError, got ${error}`);

        return error.violation as ContractViolation;
    }

    nodeAssert.fail('expected a contract failure');
};

@invariant(({ self }) => self._balance >= 0)
class Account extends Contracted {
    public _balance = 0;

    get balance() { return this._balance; }

    @demands(({ args: [amount] }) => amount > 0)
    @ensures(({ self, args: [amount], old }) => self._balance === old._balance + amount)
    deposit(amount: number): void { this._balance += amount; }

    @demands(({ self, args: [amount] }) => amount <= self._balance)
    withdraw(amount: number): void { this._balance -= amount; }
}

nodeAssert.throws(fn, AssertionError);                    // the failure happened
violationOf(fn).contract;                                // '@demands', '@ensures', …
violationOf(fn).feature;                                 // the feature name
nodeAssert.throws(fn, /^AssertionError: @demands failed for Account\.withdraw/);
```

`violationOf` is one of the few helpers worth writing: the library publishes
`getContractMetadata` for *inspection*, but no helper for the `try`/`catch`/`instanceof`
shape that every test asserting a failure has to write. Keep it in the project's own
test helpers.

For state that must hold across a sweep, the invariant is the oracle, so the loop has
no assertion of its own:

```typescript
const account = Account.new();

for (const amount of [10, -1, 5, -20, 3]) {
    try { account.deposit(amount); } catch { /* refused by @demands */ }
    nodeAssert.ok(account.balance >= 0);
}
```

Note that `Contracted.new(...)` is still required; plain `new` is refused, and the
invariant runs once during construction, so reset any evaluation counter afterwards.

## Mocking

| Technique | Works? |
| --- | --- |
| Subclass override | **yes** — the sanctioned seam; a base `@demands` still applies to the override |
| Subclass that records, then calls `super` | **yes** — a spy |
| Patch the prototype | yes, because the prototype is not proxied |
| `Object.defineProperty(instance, 'publicMethod', …)` | **no** — refused by the encapsulation rule |
| Assign a `_`-prefixed method | accepted, but the name rule is about data; prefer a subclass |

A mock library that stubs by defining a property on the instance will fail on a
contracted class. The substitute is inheritance, which is stricter anyway: a double
that subclasses the real class must satisfy the inherited contracts, so it cannot
quietly become something the class is not.

## Async

A failed precondition on an `async` feature throws **synchronously**; it is not a
rejection, because no body was entered. So `await nodeAssert.rejects(...)` fails with
*"expected a rejection"* for a `@demands` violation, while a `@rescue`d body failure is
a genuine rejection.

```typescript
nodeAssert.throws(() => service.run(-1), AssertionError);          // @demands
await nodeAssert.rejects(() => service.run(-1), AssertionError);  // a body failure
```

A rejected `async` body has no value to describe, so `@ensures` does not run for it.
The rejection reaches the caller, or a `@rescue` if one is declared.

## Enumerating the contracts

`getContractMetadata` and `getFeatureContracts` report the arms that apply to a class
and to one feature, in evaluation order, as frozen copies. Two patterns follow.

**A structural test for a house rule.** *Every public verb declares a precondition*
becomes a single test over a list of classes, because the prototype is not proxied and
the records are enumerable:

```typescript
import { getContractMetadata } from '@final-hill/decorator-contracts';

test('every public verb declares a precondition', () => {
    for (const Class of [Account, Repository, Book]) {
        const metadata = getContractMetadata(Class);

        for (const feature of ['deposit', 'read', 'placeHold'])
            if (Class.prototype[feature])
                nodeAssert.ok(metadata.demands[feature]?.length > 0, `${Class.name}.${feature}`);
    }
});
```

`Account` and `Book` are the classes above. `Repository` stands in for any other
contracted class in the project.

A subclass reports the base's arms and its own, so an inherited verb is not falsely
reported as undeclared.

**A corpus probe per feature.** The declaration decides each verdict; the test supplies
only the inputs:

```typescript
test('add accepts positive deltas only', () => {
    const counter = Counter.new();
    const outcomes = [1, 0, -1, 5].map(value => {
        try { counter.add(value); return `${value}:ok`; }
        catch (error) { return `${value}:${(error as AssertionError).violation?.contract}`; }
    });

    nodeAssert.deepStrictEqual(outcomes, ['1:ok', '0:@demands', '-1:@demands', '5:ok']);
});
```

## Generating inputs

A predicate is opaque: calling it is the whole interface, so its inputs have to come
from somewhere else. A schema is not, because a provider may carry the **Standard JSON
Schema** trait on the same `~standard` object:

```typescript
const json = schema['~standard'].jsonSchema.input({ target: 'draft-2020-12' });
```

That is a *separate* trait layered on Standard Schema V1, so it is optional and its
coverage varies. It is also lossy: it reports bounds and `enum`, not refinements,
transforms, or a `Date`. Measured against zod 4, a refinement is dropped entirely —
`number().int().min(0).max(150).refine(n => n % 2 === 0)` emits a schema byte-identical
to the unrefined one.

So a schema arm can **propose** candidates, and `validate` decides each verdict. The
proposer only has to be plausible; a missing value wastes a case, and it cannot produce
a wrong verdict:

| Declared | Proposals | Verdicts |
| --- | --- | --- |
| `integer 0..150` | `-1, 0, 1, 149, 150, 151` | reject, accept, accept, accept, accept, reject |
| `string maxLength 4` | `""`, `"a"`, `"aaaa"`, `"aaaaa"` | accept, accept, accept, reject |
| `enum ['r','w','x']` | `r, w, x` | all accept |
| tuple `[integer 5..10]` | `[4]`, `[5]`, `[6]`, `[9]` | reject, accept, accept, accept |

An exhaustive sweep of that list is complete and deterministic when the domain is
small, and it needs no dependency. It is *not* a generator: the interior of a large
domain is unvisited, a provider without the trait offers nothing, and a property over a
**sequence** is out of reach entirely, because a value enumerator has no notion of
order.

For those cases a property-based runner is the mechanism, and the contract is the
oracle it is handed. The bridge is that a **refusal is not a failure**:

```typescript
import fc from 'fast-check';

fc.assert(fc.property(fc.integer(), amount => {
    const account = Account.new();

    try { account.deposit(amount); } catch { return true; }   // refused: not a failure

    return account.balance >= 0;                              // the invariant is the property
}));
```

The division of labour is what matters:

| | The contract | The property |
| --- | --- | --- |
| Quantifies over | every call that reaches the boundary | the domain the generator samples |
| Failure is | automatic, on the first violating call | found by search, then shrunk |
| Rejects an invalid input | **refuses it** | catches the refusal, or filters |
| Needs an oracle written | no | yes, one per property |

Model-based properties are the strongest form of this, because a plain data structure
can serve as the model and the contracted class as the system under test. fast-check 4
generates command sequences through `fc.modelRun`:

```typescript
import { Contracted, demands, ensures } from '@final-hill/decorator-contracts';

const LIMIT = 8;   // the stack's capacity, as the class declares it

class Stack extends Contracted {
    public _items: number[] = [];

    get size() { return this._items.length; }

    @demands(({ self }) => self.size < LIMIT)
    push(x: number): void { this._items.push(x); }

    @demands(({ self }) => self.size > 0)
    pop(): number { return this._items.pop()!; }
}

const push = (x: number) => ({
    check: (model: number[]) => model.length < LIMIT,
    run: (model: number[], real: Stack) => { real.push(x); model.push(x); },
});

const pop = () => ({
    check: (model: number[]) => model.length > 0,
    run: (model: number[], real: Stack) => {
        const [actual, expected] = [real.pop(), model.pop()];

        if (actual !== expected) throw new Error(`pop mismatch: ${actual} vs ${expected}`);
    },
});

fc.modelRun(
    () => ({ model: [], real: Stack.new(LIMIT) }),
    fc.commands([fc.integer().map(push), fc.constant(pop())], { maxCommands: 25 }),
);
```

The command's `check` is the feature's precondition restated over the model, so the
contract and the generator agree by construction. And a refusal is a signal rather than
noise: the `check` should have prevented it, so a throw that *does* happen is a
divergence between the contract and the model.

Filtering is the cost to watch. A generator that samples a wide domain and discards
whatever the contract refuses is exactly as fast as the refinement is loose — a
one-in-a-million refinement was measured at 815 attempts for three samples. Derive a
shape-plausible arbitrary from what the arm describes, then filter with `validate` or
with the feature's own refusal.

The library deliberately ships no generator: generation is a solver's job, and the
constraint it needs is already published as the contract.
