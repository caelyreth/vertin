/**
 * A function that resolves the raw parameter string into a dedicated type.
 *
 * You can use a custom function to parse a string into a type, e.g. parsing from
 * raw encoded input (may come from pipeline) string to a decoded string,
 * so that we could utilize all features of vertin, like constraint APIs.
 *
 * NOTE: It is not recommended to perform primitive validation in a resolver.
 * In that use case, we should consider use constraint APIs.
 */
export type FnResolver = (raw: string) => any

/**
 * Language's built-in constructor to resolve raw parameter string into
 * their corresponding primitive type.
 *
 * NOTE: Vertin only support a subset of language's built-in constructor.
 *
 * @example
 * `String`, `Number`, `BigInt`, `Boolean`
 */
export type CtorResolver
  = | StringConstructor
    | NumberConstructor
    | BigIntConstructor
    | BooleanConstructor

/**
 * A resolver is a standard function or part of a language's built-in constructor.
 * to resolve a raw parameter string into a concrete type.
 *
 * In vertin, resolving is the _first step_ a user input value becomes available.
 */
export type Resolver = FnResolver | CtorResolver | FnResolver[] | CtorResolver[]

/**
 * Utility type to extract the resolved type from a non-array resolver.
 *
 * @private
 * @template T The resolver unit type to extract
 */
type _ResolveUnit<T>
  = T extends StringConstructor ? string
    : T extends NumberConstructor ? number
      : T extends BigIntConstructor ? bigint
        : T extends BooleanConstructor ? boolean
          : T extends FnResolver ? ReturnType<T>
            : never

/**
 * Utility type to extract the resolved type from any kind of resolver.
 *
 * @private
 * @template T Any kind of {@link Resolver} type to extract
 */
export type _Resolve<T extends Resolver>
  = T extends readonly (infer U)[] ? _ResolveUnit<U>[]
    : T extends (infer U)[] ? _ResolveUnit<U>[]
      : _ResolveUnit<T>
