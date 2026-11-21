import { assert } from './assert.mjs';
import { Contracted } from './Contracted.mjs';
import type { FeatureDecoratorContext } from './types.mjs';

/**
 * The gate every feature contract decorator shares.
 *
 * `@demands`, `@ensures`, and `@rescue` apply to exactly the same kind of member:
 * an instance feature of a `Contracted` subclass, whose name is not `_`-prefixed.
 * Each used to repeat the same four assertions and the same `addInitializer`
 * check, so a rule added to one was easy to miss in the others.
 *
 * The name of the contract is passed in so the messages stay specific.
 */
export function assertFeatureContractTarget(contract: string, feature: unknown, ctx: FeatureDecoratorContext): void {
    assert(["method", "getter", "setter"].includes(ctx.kind), `${contract} decorator can only be applied to methods, getters, or setters`);
    assert(ctx.static === false, `${contract} decorator cannot be applied to static features`);
    assert(ctx.private === false, `${contract} decorator cannot be applied to private features`);
    assert(!String(ctx.name).startsWith('_'), `${contract} decorator cannot be applied to private/protected features`);

    // Registration happens at decoration time rather than in `addInitializer`,
    // which runs once per instance: doing it there appended the same predicate on
    // every instantiation, which was unbounded metadata growth and a linearly
    // growing predicate list to evaluate on each call.
    ctx.addInitializer(function () {
        assert(this instanceof Contracted, `${contract} decorator can only be applied to classes that extend Contracted`);
    });
}
