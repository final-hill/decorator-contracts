export * from './types.mjs'
export * from './standard-schema.mjs'
export * from "./AssertionError.mjs"
export * from "./assert.mjs"
export * from './iff.mjs'
export * from './implies.mjs'
export * from './Contracted.mjs'
export * from './invariant.mjs'
export * from './demands.mjs'
export * from './ensures.mjs'
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
// Declaration options are named by consumers that build an arm separately from
// the decorator registering it, so the types are part of the surface. The
// module's helpers stay internal: only the two option shapes are re-exported.
export type { ArmOptions, ViolationFactory } from './admissibility.mjs'
