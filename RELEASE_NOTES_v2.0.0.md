# v2.0.0

Two themes. The first is that contracts now fail closed: several paths could silently skip, bypass, or corrupt enforcement, and a design-by-contract library that fails open is worse than no library. The second is reach: contracts now cover asynchronous features, generators, and Standard Schema inputs.

## Features

- **Asynchronous features are fully contracted.** `@ensures` and the exit `@invariant` are evaluated after the returned promise settles, so a postcondition describes the state the body actually reached rather than a body that has not run yet. A violation reaches the caller as a rejection instead of a synchronous throw, and `@rescue` can observe and retry one. ([#319](https://github.com/final-hill/decorator-contracts/pull/319))
- **Generators and async generators are contracted.** A yield is the observable delivery of a traversal, so `@ensures` must hold for each one, and `@invariant` is re-checked on every resume — another feature called between yields therefore never sees an invalid object. `@demands` runs once for the call, and again only when a value is injected with `next(value)`. ([#320](https://github.com/final-hill/decorator-contracts/pull/320))
- **Standard Schema V1 support.** `@invariant`, `@demands`, and `@ensures` accept a Standard Schema value anywhere they accept a predicate, making Zod, Valibot, ArkType, and Effect Schema interchangeable. No provider becomes a dependency: the protocol is declared locally, so nothing needs to be installed. Normalization is opt-in. ([#321](https://github.com/final-hill/decorator-contracts/pull/321))
- **Precise, structured contract failures.** A violation names the contract, the feature, and the arms that failed, and is available structurally as `error.violation` — `{ contract, className, feature, failedIndices, predicates, issues? }`. Schema failures carry the provider's own `issues`, including dotted paths. ([#310](https://github.com/final-hill/decorator-contracts/pull/310))

## Bugfixes

- Contracts could stay disabled for the whole process after a predicate threw while the `old` snapshot was being taken. ([#299](https://github.com/final-hill/decorator-contracts/pull/299))
- Retrying through `@rescue` skipped `@demands`, `@ensures`, and the exit `@invariant`, and crashed outright when the feature was inherited. Retries now restart the full lifecycle and are bounded by `maxRetries`. ([#300](https://github.com/final-hill/decorator-contracts/pull/300))
- The `old` snapshot was shallow, so a postcondition could compare against state its own body had already mutated. It is now deep, and method identity is stable across accesses. ([#303](https://github.com/final-hill/decorator-contracts/pull/303))
- A non-boolean predicate result was accepted through truthiness — which meant an accidentally asynchronous predicate, always truthy, silently passed. Predicates must now return a literal `true` or `false`. ([#302](https://github.com/final-hill/decorator-contracts/pull/302))
- Predicate registration grew without bound, appending once per instantiation and evaluating a longer list on every call. Registration now happens at decoration time. ([#301](https://github.com/final-hill/decorator-contracts/pull/301))
- Accessors could start a nested lifecycle, evaluating the invariant four times instead of two. ([#304](https://github.com/final-hill/decorator-contracts/pull/304))
- Deleting a property ignored both the assignment rule and checked mode. ([#307](https://github.com/final-hill/decorator-contracts/pull/307))
- A predicate could be written with the wrong signature and still compile, passing only through coercion. The argument list is now typed so the mistake is a compile error. ([#308](https://github.com/final-hill/decorator-contracts/pull/308))
- A `new` nested inside a constructor could obtain a raw, unproxied instance and defeat every contract. ([#313](https://github.com/final-hill/decorator-contracts/pull/313))
- `iff` and `implies` returned an operand instead of a boolean when given a non-boolean, leaking an object through a `boolean` signature. ([#323](https://github.com/final-hill/decorator-contracts/pull/323))
- Contract predicates could mutate the instance while it was being checked, which let a predicate repair the very state an invariant was about to verify. ([#324](https://github.com/final-hill/decorator-contracts/pull/324))

## Chores

- Updated dependencies. ([#278](https://github.com/final-hill/decorator-contracts/pull/278))
- Contracts are modelled as Hoare triples `{ P } C { Q }`: the contracts describe the observable boundary, and a feature body runs against the instance directly, so internal calls do not start a second lifecycle. ([#306](https://github.com/final-hill/decorator-contracts/pull/306))
- The test suite is now type-checked. Enabling it immediately surfaced 21 real errors in consumer-shaped code. ([#309](https://github.com/final-hill/decorator-contracts/pull/309))
- `exports.types` and `types` point at the declaration file the build actually emits, so modern module resolution no longer collapses the package to `any`. ([#311](https://github.com/final-hill/decorator-contracts/pull/311))
- The build no longer rewrites tracked source files. ([#312](https://github.com/final-hill/decorator-contracts/pull/312))
- CI runs on Linux against the declared Node floor, with coverage and a clean-working-tree check. ([#314](https://github.com/final-hill/decorator-contracts/pull/314))
- Added a development container pinned to the CI Node version, so a local environment cannot drift from CI. ([#315](https://github.com/final-hill/decorator-contracts/pull/315), [#317](https://github.com/final-hill/decorator-contracts/pull/317))

## Upgrade notes

- **Node.js 26 or later** is required; `engines.node` is now `>=26`.
- **Predicates must return a literal boolean.** A `Promise`, a string, or a number is a failure rather than a truthy pass.
- **Predicates may not mutate the instance.** They receive a read-only view; `rescue` remains unrestricted, since restoring state is its purpose.
- **A synchronous feature that returns a promise is rejected.** Declare it `async` instead.
- **Type entry points moved** to the emitted `.d.mts` files. Projects resolving the old paths will now see real types where they previously saw `any` — including any errors those types reveal.
