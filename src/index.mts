export * from './types.mjs'
export * from './standard-schema.mjs'
export * from "./AssertionError.mjs"
export * from "./assert.mjs"
export * from './iff.mjs'
export * from './implies.mjs'
export * from './Contracted.mjs'
export * from './invariant.mjs'
// Listed rather than `export *` so the lifecycle plumbing stays off the entry
// point. `assertDemands`, `assertEnsures`, and the registered-arm shapes are the
// surface each module already carried; the awaited compositions and the
// awaitability probes are called only by the lifecycle, which imports the module
// directly.
export {
    assertDemands,
    demands,
} from './demands.mjs'
export type {
    DemandsArm, DemandsDecorator, DemandsPredicate, DemandsSubject, RegisteredDemands,
} from './demands.mjs'
export {
    assertEnsures,
    ensures,
} from './ensures.mjs'
export type {
    EnsuresArm, EnsuresDecorator, EnsuresPredicate, EnsuresSubject, RegisteredEnsures,
} from './ensures.mjs'
// Listed rather than `export *` so `rescueDeclarationOf` stays off the entry
// point. It is the resolution rule the proxy and `getFeatureContracts` share, it
// takes a raw metadata record, and it returns the live declaration — which is the
// capability `getContractMetadata` exists to deny by returning copies. The names
// below are the declaration surface plus the two helpers the surface already
// carried.
export {
    applyRescueHandler, getRescueDeclaration, rescue,
} from './rescue.mjs'
export type {
    RescueDecorator, RescueDeclaration, RescueHandler, RescueOptions, RescueSubject,
} from './rescue.mjs'
export * from './metadata.mjs'
// Only the symbol is published. `classNameOf` resolves the name for the runtime's
// own failure paths and is not a capability a consumer needs: one building a
// diagnostic already holds the constructor it would pass to it.
export { contractName } from './name.mjs'
// The decorator is the surface; the module's checks and helpers are not.
export { serializable } from './serialization.mjs'
// Declaration options are named by consumers that build an arm separately from
// the decorator registering it, so the types are part of the surface. The
// module's helpers stay internal: only the two option shapes are re-exported.
export type { ArmOptions, ViolationFactory } from './admissibility.mjs'
