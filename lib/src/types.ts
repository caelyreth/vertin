/**
 * @file Essential types across Vertin framework.
 *
 * This file contains all shared type across the framework Vertin.
 * Those types with `_` prefix are internal types, although they are
 * exported, they are not intended to be used directly by developers.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

// MARK: - Collector

/**
 * Severity level of a message in collector subsystem.
 */
export type Severity = 'info' | 'warn' | 'error'

/**
 * Diagnostics of a message in collector subsystem.
 */
export interface Diagnostics {
  /**
   * Source of the diagnostics.
   */
  readonly source: Plural<string>

  /**
   * Offset of the diagnostics.
   *
   * - If the source is an array, the offset is the index of the source in the array.
   * - If the source is a string, the offset is the index of the character in the string.
   */
  readonly offset: number

  /**
   * Markup of the diagnostics.
   *
   * The text shows next to the `^` marks under the source line.
   */
  readonly markup: string

  /**
   * Expected values of the diagnostics.
   */
  readonly expected?: Plural<string>

  /**
   * Hint of the diagnostics.
   */
  readonly hint?: Plural<string>
}

/**
 * Message of a message in collector subsystem.
 */
export interface Message {
  /**
   * Severity level of the message.
   */
  readonly level: Severity

  /**
   * Description of the message.
   */
  readonly desc: string

  /**
   * Diagnostics of the message.
   */
  readonly diag?: Diagnostics
}

/**
 * Collector interface.
 */
export interface Collector {
  /**
   * Log a message or messages to the collector.
   *
   * Will display the message immediately.
   */
  log: (msgs: Plural<Message>, brief?: boolean) => void

  /**
   * Submit a message or messages to the collector.
   *
   * Only queue the message, will not display it immediately.
   */
  submit: (msgs: Plural<Message>, brief?: boolean) => void

  /**
   * Collect and display all queued messages.
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
  readonly value: T

  /**
   * Collector subsystem context.
   */
  readonly collector: Collector
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
   * Constraint function to check if the parameter is valid.
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
  readonly alias?: Plural<string>
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
 * Section style flag specification.
 */
export interface FlagSection<T extends FlagRecord = FlagRecord> {
  /**
   * Brief description of the flag section.
   */
  readonly desc?: string

  // TODO!: add more features to section grouping

  /**
   * Flags in the flag section.
   */
  readonly flags: (keyof T)[]
}

// MARK: - Parsed Parameter

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
 *
 * @private
 */
export type _ParameterMap<T extends Record<string, _BaseParameter>> = {
  [K in keyof T]: Omit<T[K], 'fallback' | 'constr'> & {
    fallback?: NoInfer<_Resolve<_GetResolver<T[K]>>>
    constr?: Constraint<NoInfer<_Resolve<_GetResolver<T[K]>>>>
  }
}

/**
 *
 */
export type _FlagSectionsMap<S extends FlagSection[], F extends FlagRecord> = {
  [K in keyof S]: S[K] extends FlagSection
    ? FlagSection<F>
    : never
}

/**
 * Utility type to parse argument record to a parsed argument record.
 */
type _ParsedArgument<
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
type _ParsedFlagRecord<
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
  A extends ArgumentRecord = ArgumentRecord,
  F extends FlagRecord = FlagRecord,
> {
  /**
   * Parsed arguments.
   */
  readonly args: A extends undefined ? never
    : _ParsedArgument<NonNullable<A>>

  /**
   * Parsed flags.
   */
  readonly flags: F extends undefined ? never
    : _ParsedFlagRecord<NonNullable<F>>

  /**
   * Unknown arguments.
   */
  readonly unkArgs?: string[]

  /**
   * Unknown flags.
   */
  readonly unkFlags?: (string | boolean)[]
}

// MARK: - Command

export type HandlerContext<
  A extends ArgumentRecord,
  F extends FlagRecord,
> = _Parsed<A, F> & {
  /**
   * Collector subsystem context.
   */
  readonly collector: Collector

  /**
   * Internal context for the command.
   *
   * NOTE: Those APIs may be __changed without any notice__.
   *
   * @private
   */
  __internal__: {
    /**
     * Access the whole application specification.
     *
     * @private
     */
    readonly app: App
  }
}

/**
 * Command specification.
 */
export interface Command<
  A extends ArgumentRecord = ArgumentRecord,
  F extends FlagRecord = FlagRecord,
  S extends FlagSection[] = FlagSection[],
> {
  /**
   * Brief description of command.
   */
  readonly desc?: string

  /**
   * Arguments of the command.
   */
  readonly args?: A

  /**
   * Flags of the command.
   */
  readonly flags?: F

  /**
   * Sections of flags in the command.
   */
  readonly sections?: S

  /**
   * Sub-commands of the command.
   */
  readonly sub?: Record<string, Command>

  /**
   * Handler function of the command.
   *
   * @todo complete handler system, currently it's just a placeholder.
   */
  readonly handler: (ctx: HandlerContext<A, F>) => void
}

/**
 * Internal commands of the Vertin framework.
 *
 * @private
 */
export interface _InternalCommands {
  /**
   * Help command.
   */
  help?: Command

  /**
   * Completion command.
   */
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
  readonly desc: string

  /**
   * Version of the app.
   */
  readonly ver?: string

  /**
   * Main command of the app.
   */
  readonly main?: Command

  /**
   * Sub-commands of the app.
   */
  readonly sub?: Record<string, Command>

  /**
   * Vertin framework configuration.
   */
  readonly config?: AppConfig
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

/**
 * Utility type to make a type to include itself and its array form.
 */
export type Plural<T> = T | T[]

/**
 * Utility type to convert a union type to an intersection type.
 */
export type UnionToIntersection<U>
  = (U extends any ? (x: U) => void : never) extends
  (x: infer I) => void ? I : never

/**
 * Utility type to merge multiple objects into a single object.
 */
export type MergeObjects<T extends readonly object[]>
  = UnionToIntersection<T[number]> extends infer O
    ? { [K in keyof O]: O[K] }
    : never
