/**
 * @file Essential types across Vertin framework.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

// MARK: - Collector

/**
 *
 */
export type Severity = 'info' | 'warn' | 'error'

/**
 *
 */
export interface Diagnostics {
  /**
   *
   */
  readonly source: string | string[]

  /**
   *
   */
  readonly offset: number

  /**
   *
   */
  readonly markup: string

  /**
   *
   */
  readonly expected?: string | string[]

  /**
   *
   */
  readonly hint?: string | string[]
}

/**
 *
 */
export interface Message {
  /**
   *
   */
  readonly level: Severity

  /**
   *
   */
  readonly desc: string

  /**
   *
   */
  readonly diag?: Diagnostics
}

/**
 *
 */
export interface Collector {
  /**
   *
   */
  log: (msgs: Message | Message[], brief?: boolean) => void

  /**
   *
   */
  submit: (msgs: Message | Message[], brief?: boolean) => void

  /**
   *
   */
  collect: (brief?: boolean) => void
}

// MARK: - Resolver

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

// MARK: - Constraint

/**
 * Constraint checking context.
 */
export interface ConstraintContext<T> {
  /**
   * Raw value of current field.
   */
  value: T
}

/**
 * Constraint function to check if a value is valid.
 */
export type Constraint<T> = (ctx: ConstraintContext<T>) => void

// MARK: - Parameter

/**
 * Base parameter specification.
 *
 * @private
 * @template T {@link Resolver} used to parse raw string value.
 */
interface _BaseParameter<T extends Resolver = Resolver> {
  /**
   * {@link Resolver} used to parse raw string value.
   *
   * @default
   * `String`
   */
  readonly resolver?: T

  /**
   * Brief description of parameter.
   */
  readonly desc?: string

  /**
   * Fallback value if parameter field omitted.
   */
  readonly fallback?: _Resolve<T>

  /**
   *
   */
  readonly constr?: Constraint<_Resolve<T>>
}

/**
 * Argument parameter specification.
 *
 * @template T {@link Resolver} used to parse the raw string value.
 */
export interface Argument<T extends Resolver = Resolver> extends _BaseParameter<T> {
  /**
   * Whether the argument field is optional.
   *
   * @default false
   */
  readonly optional?: boolean
}

/**
 * Flag parameter specification.
 *
 * @template T {@link Resolver} used to parse raw string value.
 */
export interface Flag<T extends Resolver = Resolver> extends _BaseParameter<T> {
  /**
   * Whether the flag field is required.
   *
   * @default false
   */
  readonly required?: boolean

  /**
   * Alias for the flag field.
   *
   * A single character string will become a single dash prefixed flag,
   * while a multi-character string will become a double dash prefixed flag.
   */
  readonly alias?: string | string[]
}

/**
 * Record type for argument and flag specifications.
 */
export type ArgumentRecord = Record<string, Argument>

/**
 * Record type for argument and flag specifications.
 */
export type FlagRecord = Record<string, Flag>

/**
 * Utility type to extract resolver type from an parameter specification.
 * It's used to implement the default string resolver inference.
 *
 * @private
 */
export type _GetResolver<T extends Argument> = T['resolver'] extends Resolver
  ? T['resolver']
  : StringConstructor

/**
 * Utility type to map a parameter record to a parameter map.
 *
 * Used to implement spec-level inference.
 */
export type _ParameterMap<T extends Record<string, _BaseParameter>> = {
  [K in keyof T]: Omit<T[K], 'fallback' | 'constr'> & {
    fallback?: NoInfer<_Resolve<_GetResolver<T[K]>>>
    constr?: Constraint<NoInfer<_Resolve<_GetResolver<T[K]>>>>
  }
}

/**
 * Utility type to parse argument record to a parsed argument record.
 */
export type _ParsedArgument<
  T extends ArgumentRecord,
> = {
  [K in keyof T]: T[K]['fallback'] extends _Resolve<_GetResolver<T[K]>>
    ? _Resolve<_GetResolver<T[K]>>
    : T[K]['optional'] extends true ? _Resolve<_GetResolver<T[K]>> | undefined
      : _Resolve<_GetResolver<T[K]>>
}

/**
 * Utility type to parse flag record to a parsed flag record.
 */
export type _ParsedFlag<
  T extends FlagRecord,
> = {
  [K in keyof T]: T[K]['fallback'] extends _Resolve<_GetResolver<T[K]>>
    ? _Resolve<_GetResolver<T[K]>>
    : T[K]['required'] extends true ? _Resolve<_GetResolver<T[K]>>
      : _Resolve<_GetResolver<T[K]>> | undefined
}

/**
 * Utility type to parse argument and flag record to a parsed argument and flag record.
 */
export interface _Parsed<
  A = ArgumentRecord,
  F = FlagRecord,
> {
  args: A extends undefined ? never
    : _ParsedArgument<NonNullable<A>>

  flags: F extends undefined ? never
    : _ParsedFlag<NonNullable<F>>

  // TODO: unknown flags and arguments
}

// MARK: - Command

export type HandlerContext<
  A extends ArgumentRecord,
  F extends FlagRecord,
> = _Parsed<A, F> & {
  // TODO: more context features
}

/**
 * Command specification.
 */
export interface Command<
  A extends ArgumentRecord = ArgumentRecord,
  F extends FlagRecord = FlagRecord,
> {
  /**
   * Brief description of command.
   */
  desc?: string

  /**
   * Arguments of the command.
   */
  args?: A

  /**
   * Flags of the command.
   */
  flags?: F

  /**
   * Sub-commands of the command.
   */
  sub?: Record<string, Command>

  /**
   * Handler function of the command.
   *
   * @todo complete handler system, currently it's just a placeholder.
   */
  handler: (ctx: HandlerContext<A, F>) => void
}

/**
 *
 */
export interface _InternalCommands {
  help?: Command
  completion?: Command
}

// MARK: - App

/**
 * Vertin framework configuration.
 *
 * @todo complete configuration system, currently it's just a placeholder.
 */
export interface AppConfig {}

/**
 * Application specification.
 */
export interface App {
  /**
   * Brief description of the app.
   */
  desc: string

  /**
   * Version of the app.
   */
  ver?: string

  /**
   * Main command of the app.
   */
  main?: Command

  /**
   * Sub-commands of the app.
   */
  sub?: Record<string, Command>

  /**
   * Vertin framework configuration.
   */
  config?: AppConfig
}

// MARK: - Utilities

/**
 * Represents a successful operation.
 *
 * @template T The type of the successful value.
 */
export interface Success<T> {
  readonly success: true
  readonly value: T
}

/**
 * Represents a failed operation.
 * @template E The type of the error value.
 */
export interface Failure<E> {
  readonly success: false
  readonly errors: E
}

/**
 * A union type that can be either Success<T> or Failure<E>.
 * @template T The type of the successful value.
 * @template E The type of the error value.
 */
export type Result<T, E = string[]> = Success<T> | Failure<E>
