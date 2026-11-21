/**
 * The Standard Schema V1 protocol.
 *
 * Declared locally rather than imported so that the library has no runtime or
 * type dependency on any schema provider. The shapes below are structurally
 * identical to `@standard-schema/spec`, so a Zod, Valibot, ArkType, or Effect
 * Schema object satisfies them without the caller installing anything on our
 * behalf — and without us choosing a vendor.
 *
 * ref: https://github.com/standard-schema/standard-schema
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
    readonly '~standard': StandardSchemaV1.Props<Input, Output>;
}

/* eslint-disable @typescript-eslint/no-namespace -- Declaration merging is how the
   spec itself shapes the type: `StandardSchemaV1.Props`, `StandardSchemaV1.Issue`
   and friends must be reachable as members of the interface's own name. */
export declare namespace StandardSchemaV1 {
    interface Props<Input = unknown, Output = Input> {
        readonly version: 1;
        readonly vendor: string;
        readonly types?: Types<Input, Output> | undefined;
        readonly validate: (value: unknown, options?: Options) => Result<Output> | Promise<Result<Output>>;
    }

    interface Types<Input = unknown, Output = Input> {
        readonly input: Input;
        readonly output: Output;
    }

    interface Options {
        readonly libraryOptions?: Record<string, unknown> | undefined;
    }

    type Result<Output> = SuccessResult<Output> | FailureResult;

    interface SuccessResult<Output> {
        readonly value: Output;
        readonly issues?: undefined;
    }

    interface FailureResult {
        readonly issues: ReadonlyArray<Issue>;
    }

    interface Issue {
        readonly message: string;
        readonly path?: ReadonlyArray<PropertyKey | PathSegment> | undefined;
    }

    interface PathSegment {
        readonly key: PropertyKey;
    }

    type InferInput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['input'];
    type InferOutput<Schema extends StandardSchemaV1> = NonNullable<Schema['~standard']['types']>['output'];
}
