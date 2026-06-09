/**
 * @file Essential types across Vertin framework.
 *
 * This file contains shared framework types. Types with an `_` prefix are
 * exported for inference support and are not intended for direct user code.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

// MARK: - Collector

/** Severity level of a message in collector subsystem. */
export type Severity = 'info' | 'warn' | 'error'

/** Diagnostics of a message in collector subsystem. */
export interface Diagnostics {
  /** Optional text shown before the diagnostic source. */
  readonly prefix?: string

  /** Source of the diagnostics. */
  readonly source: _Many<string>

  /**
   * Offset of the diagnostics.
   *
   * - If the source is an array, the offset is the index of the source in the
   *   array.
   * - If the source is a string, the offset is the index of the character in the
   *   string.
   */
  readonly offset: number

  /**
   * Markup of the diagnostics.
   *
   * The text shows next to the `^` marks under the source line.
   */
  readonly markup: string

  /** Expected values of the diagnostics. */
  readonly expected?: _Many<string>

  /** Hint of the diagnostics. */
  readonly hint?: _Many<string>
}

/** Message emitted by the collector subsystem. */
export interface Message {
  /** Severity level of the message. */
  readonly level: Severity

  /** Description of the message. */
  readonly desc: string

  /** Diagnostics of the message. */
  readonly diag?: Diagnostics
}

/** Collector interface. */
export interface Collector {
  /**
   * Log a message or messages to the collector.
   *
   * Will display the message immediately.
   */
  log: (msgs: _Many<Message>, brief?: boolean) => void

  /**
   * Submit a message or messages to the collector.
   *
   * Only queue the message, will not display it immediately.
   */
  submit: (msgs: _Many<Message>, brief?: boolean) => void

  /** Collect and display all queued messages. */
  collect: (brief?: boolean) => void
}

// MARK: - Resolver

/**
 * A function that derives a dedicated type from a raw value string.
 *
 * You can use a custom function to parse a string into a _dedicated type_, e.g.
 * parsing from raw encoded input string to a decoded type, so that we could
 * utilize all _built-in features_ of Vertin with that type.
 */
export type _ResolverFn<R = unknown> = (raw: string) => R

/**
 * Built-in constructor that derives a primitive type from a raw value string.
 *
 * Vertin only supports a subset of built-in constructors. You can use a
 * function resolver to support other types in construction.
 */
export type _ResolverCtor =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor

/**
 * Function or supported constructor used to derive a concrete value from a raw
 * string.
 *
 * A {@link Resolver} controls the value type exposed through
 * {@link HandlerContext}. Use `constr` for user-facing validation and richer
 * diagnostics.
 */
export type Resolver =
  | _ResolverFn
  | _ResolverCtor
  | readonly _ResolverFn[]
  | readonly _ResolverCtor[]

/**
 * Utility type to extract the resolved type from a non-array resolver.
 *
 * @private
 * @template T The resolver unit type to extract
 */
type _ResolveUnit<T> = T extends StringConstructor
  ? string
  : T extends NumberConstructor
    ? number
    : T extends BooleanConstructor
      ? boolean
      : T extends _ResolverFn
        ? ReturnType<T>
        : never

/**
 * Utility type to extract the derived type from any {@link Resolver}.
 *
 * @private
 * @template T Any kind of {@link Resolver} type to extract
 */
export type _Resolve<T extends Resolver> = T extends readonly (infer U)[]
  ? _ResolveUnit<U>[]
  : T extends (infer U)[]
    ? _ResolveUnit<U>[]
    : _ResolveUnit<T>

// MARK: - Validator

/** Working context of a validator. */
export interface ValidatorContext<T> {
  /** Raw value of current field. */
  readonly value: T

  /** Collector subsystem context. */
  readonly collector: Collector
}

/**
 * Function that validates a resolved value.
 *
 * Validators centralize runtime checks, diagnostics, and future completion
 * metadata.
 */
export type Validator<T> = (ctx: ValidatorContext<T>) => void

// MARK: - Parameter

/**
 * Base parameter specification.
 *
 * @private
 * @template T {@link Resolver} used to parse raw string value.
 */
interface _Param<T extends Resolver = Resolver> {
  /**
   * {@link Resolver} used to parse raw string value.
   *
   * @default
   * `String`
   */
  readonly resolver?: T

  /** Brief description of parameter. */
  readonly desc?: string

  /** Fallback value if parameter field omitted. */
  readonly fallback?: _Resolve<T>

  /** Validator function to check if the parameter is valid. */
  readonly constr?: Validator<_Resolve<T>>
}

/**
 * Argument parameter specification.
 *
 * @template T {@link Resolver} used to parse the raw string value.
 */
export interface Argument<T extends Resolver = Resolver> extends _Param<T> {
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
export interface Flag<T extends Resolver = Resolver> extends _Param<T> {
  /**
   * Whether the flag field is required.
   *
   * @default false
   */
  readonly required?: boolean

  /**
   * Alias for the flag field.
   *
   * A single character string will become a single dash prefixed flag, while a
   * multi-character string will become a double dash prefixed flag.
   */
  readonly alias?: _Many<string>
}

/** Record type for argument specifications. */
export type _Args = Record<string, Argument>

/** Record type for flag specifications. */
export type _Flags = Record<string, Flag>

// MARK: - Parsed Parameter

/**
 * Utility type to extract resolver type from a parameter specification. It's
 * used to implement the default string resolver inference.
 *
 * @private
 */
export type _ResolverOf<T extends _Param> = T['resolver'] extends Resolver
  ? T['resolver']
  : StringConstructor

/**
 * Utility type to map a parameter record to a parameter map.
 *
 * Used to implement spec-level inference.
 *
 * @private
 */
export type _ParamMap<T extends Record<string, _Param>> = {
  [K in keyof T]: Omit<T[K], 'fallback' | 'constr'> & {
    fallback?: NoInfer<_Resolve<_ResolverOf<T[K]>>>
    constr?: Validator<NoInfer<_Resolve<_ResolverOf<T[K]>>>>
  }
}

/** Utility type to parse an argument record into resolved argument values. */
type _ParsedArgs<T extends _Args> = {
  [K in keyof T]: T[K]['fallback'] extends _Resolve<_ResolverOf<T[K]>>
    ? _Resolve<_ResolverOf<T[K]>>
    : T[K]['optional'] extends true
      ? _Resolve<_ResolverOf<T[K]>> | undefined
      : _Resolve<_ResolverOf<T[K]>>
}

/** Utility type to parse a flag record into resolved flag values. */
type _ParsedFlags<T extends _Flags> = {
  [K in keyof T]: T[K]['fallback'] extends _Resolve<_ResolverOf<T[K]>>
    ? _Resolve<_ResolverOf<T[K]>>
    : T[K]['required'] extends true
      ? _Resolve<_ResolverOf<T[K]>>
      : _Resolve<_ResolverOf<T[K]>> | undefined
}

/**
 * Utility type to parse argument and flag record to a parsed argument and flag
 * record.
 */
export interface _Parsed<
  A extends _Args = _Args,
  F extends _Flags = _Flags,
  P extends Snippet[] = Snippet[],
> {
  /** Parsed arguments. */
  readonly args: _ParsedArgs<NonNullable<A>> &
    _Merge<{
      [K in keyof P]: _ParsedArgs<NonNullable<P[K]['args']>>
    }>

  /** Parsed flags. */
  readonly flags: _ParsedFlags<NonNullable<F>> &
    _Merge<{
      [K in keyof P]: _ParsedFlags<NonNullable<P[K]['flags']>>
    }>

  /** Unknown arguments. */
  readonly unkArgs?: string[]

  /** Unknown flags. */
  readonly unkFlags?: (string | boolean)[]
}

// MARK: - Snippet

export interface Snippet<A extends _Args = _Args, F extends _Flags = _Flags> {
  /** Arguments in the snippet. */
  readonly args?: A

  /** Flags in the snippet. */
  readonly flags?: F
}

/** Utility type to preserve snippet-level inference. */
export type _SnippetMap<T extends Snippet> = Snippet & {
  flags?: _Flags & _ParamMap<NonNullable<T['flags']>>
  args?: _Args & _ParamMap<NonNullable<T['args']>>
}

// MARK: - Command

export type HandlerContext<
  A extends _Args,
  F extends _Flags,
  P extends Snippet[],
> = _Parsed<A, F, P> & {
  /** Collector subsystem context. */
  readonly collector: Collector

  /**
   * Internal context for the command.
   *
   * NOTE: Those APIs may be **changed without any notice**.
   *
   * @private
   */
  readonly __internal__: {
    /**
     * Access the whole application specification.
     *
     * @private
     */
    readonly app: App
  }
}

/** Record type for command specifications. */
export type _Commands = Record<string, Command>

/** Command specification. */
export interface Command<
  A extends _Args = _Args,
  F extends _Flags = _Flags,
  C extends _Commands = _Commands,
  P extends Snippet[] = Snippet[],
> {
  /** Brief description of command. */
  readonly desc?: string

  /** Arguments of the command. */
  readonly args?: A

  /** Flags of the command. */
  readonly flags?: F

  /** Sub-commands of the command. */
  readonly sub?: C

  /** Snippets used in the command. */
  readonly use?: P

  /** Handler function of the command. */
  readonly handler: (ctx: HandlerContext<A, F, P>) => void
}

// MARK: - App

/** Vertin framework configuration. */
export interface AppConfig {}

/** Application specification. */
export interface App<C extends _Commands = _Commands> {
  /** Brief description of the app. */
  readonly desc?: string

  /** Version of the app. */
  readonly ver?: string

  /** Main command of the app. */
  readonly main?: Command

  /** Sub-commands of the app. */
  readonly sub?: C

  /** Vertin framework configuration. */
  readonly config?: AppConfig
}

// MARK: - Utilities

/**
 * Represents a successful operation.
 *
 * @template T The type of the successful value.
 */
export interface _Ok<T> {
  readonly success: true
  readonly value: T
}

/**
 * Represents a failed operation.
 *
 * @template E The type of the error value.
 */
export interface _Err<E> {
  readonly success: false
  readonly errors: E
}

/**
 * A union type that can be either _Ok<T> or _Err<E>.
 *
 * @template T The type of the successful value.
 * @template E The type of the error value.
 */
export type _Result<T, E = string[]> = _Ok<T> | _Err<E>

/** Utility type to make a type to include itself and its array form. */
export type _Many<T> = T | T[]

/** Utility type to convert a union type to an intersection type. */
export type _Intersect<U> = (
  U extends unknown ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never

/** Utility type to merge multiple objects into a single object. */
export type _Merge<T extends readonly object[]> =
  _Intersect<T[number]> extends infer O ? { [K in keyof O]: O[K] } : never
