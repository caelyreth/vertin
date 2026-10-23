/**
 * @license MIT
 * @file Essential types across Vertin framework. This file contains shared
 *   framework types. Types with an `_` prefix are exported for inference
 *   support and are not intended for direct user code.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

// MARK: - internal diagnostics

/**
 * Severity level of an internal runtime message.
 */
export type _Severity = 'info' | 'warn' | 'error'

/**
 * Diagnostics of an internal runtime message.
 */
export interface _Diagnostics {
  /**
   * Optional text shown before the diagnostic source.
   */
  readonly prefix?: string

  /**
   * Source of the diagnostics.
   */
  readonly source: _Many<string>

  /**
   * Offset of the diagnostics.
   *
   * - If the source is an array, the offset is the index of the source in the
   *   array.
   * - If the source is a string, the offset is the index of the character in
   *   the string.
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
  readonly expected?: _Many<string>

  /**
   * Hint of the diagnostics.
   */
  readonly hint?: _Many<string>
}

/**
 * Message emitted by the internal collector.
 */
export interface _Message {
  /**
   * Severity level of the message.
   */
  readonly level: _Severity

  /**
   * Description of the message.
   */
  readonly desc: string

  /**
   * Diagnostics of the message.
   */
  readonly diag?: _Diagnostics
}

/**
 * Internal collector interface.
 */
export interface _Collector {
  /**
   * Log a message or messages to the collector.
   *
   * Will display the message immediately.
   */
  log: (msgs: _Many<_Message>, brief?: boolean) => void

  /**
   * Submit a message or messages to the collector.
   *
   * Only queue the message, will not display it immediately.
   */
  submit: (msgs: _Many<_Message>, brief?: boolean) => void

  /**
   * Collect and display all queued messages.
   */
  collect: (brief?: boolean) => void

  /**
   * Whether any submitted or logged message is an error.
   */
  has_errors: () => boolean
}

// MARK: - resolver

/**
 * A function that derives a dedicated type from a raw value string.
 *
 * You can use a custom function to parse a string into a _dedicated type_,
 * e.g. parsing from raw encoded input string to a decoded type, so that we
 * could utilize all _built-in features_ of Vertin with that type.
 */
export type _ResolverFn<R = unknown> = (raw: string) => R

/**
 * Built-in constructor that derives a primitive type from a raw value
 * string.
 *
 * Vertin only supports a subset of built-in constructors. You can use a
 * function resolver to support other types in construction.
 */
export type _ResolverCtor =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor

/**
 * Function or supported constructor used to derive a concrete value from a
 * raw string.
 *
 * A {@link Resolver} controls the value type exposed through
 * {@link HandlerContext}. Use `check` for user-facing audits and richer
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

type _ChoiceOf<T extends Resolver> =
  _Resolve<T> extends readonly (infer U)[] ? U : _Resolve<T>

// MARK: - checking

/**
 * Working context of a check function.
 */
export interface CheckContext<T> {
  /**
   * Resolved value of current field.
   */
  readonly value: T
}

type _CheckResult = void | boolean | string

/**
 * Function that audits a resolved value.
 *
 * Return `false` or a string to report a non-fail-fast check failure.
 */
export type Check<T> = {
  bivariance(ctx: CheckContext<T>): _CheckResult | Promise<_CheckResult>
}['bivariance']

// MARK: - parameter

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

  /**
   * Brief description of parameter.
   */
  readonly desc?: string

  /**
   * Allowed resolved values. Array parameters check each item.
   */
  readonly choices?: readonly _ChoiceOf<T>[]

  /**
   * Fallback value if parameter field omitted.
   */
  readonly fallback?: _Resolve<T>

  /**
   * Whether the parameter must be provided when no fallback exists.
   *
   * Arguments default to `true`; flags default to `false`.
   */
  readonly required?: boolean

  /**
   * Check function to audit if the parameter is valid.
   */
  readonly check?: Check<_Resolve<T>>
}

/**
 * Argument parameter specification.
 */
export type Argument<T extends Resolver = Resolver> = _Param<T>

/**
 * Flag parameter specification.
 *
 * @template T {@link Resolver} used to parse raw string value.
 */
export interface Flag<T extends Resolver = Resolver> extends _Param<T> {
  /**
   * Alias for the flag field.
   *
   * A single character string will become a single dash prefixed flag,
   * while a multi-character string will become a double dash prefixed
   * flag.
   */
  readonly alias?: _Many<string>
}

/**
 * Record type for argument specifications.
 */
export type _Args = Record<string, Argument>

/**
 * Record type for flag specifications.
 */
export type _Flags = Record<string, Flag>

// MARK: - parsed parameter

/**
 * Utility type to extract resolver type from a parameter specification.
 * It's used to implement the default string resolver inference.
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
  [K in keyof T]: Omit<T[K], 'fallback' | 'check' | 'choices'> & {
    choices?: readonly NoInfer<_ChoiceOf<_ResolverOf<T[K]>>>[]
    fallback?: NoInfer<_ValueOf<T[K]>>
    check?: Check<NoInfer<_ValueOf<T[K]>>>
  }
}

type _ValueOf<T extends _Param> = T extends {
  readonly choices: readonly (infer U)[]
}
  ? _Resolve<_ResolverOf<T>> extends readonly unknown[]
    ? Extract<U, _ChoiceOf<_ResolverOf<T>>>[]
    : Extract<U, _ChoiceOf<_ResolverOf<T>>>
  : _Resolve<_ResolverOf<T>>

type _Required<T extends _Param, D extends boolean> = T extends {
  readonly required: infer R
}
  ? R extends true
    ? true
    : false
  : D

type _ParsedParam<T extends _Param, D extends boolean> =
  T['fallback'] extends _ValueOf<T>
    ? _ValueOf<T>
    : _Required<T, D> extends infer R
      ? R extends true
        ? _ValueOf<T>
        : _ValueOf<T> | undefined
      : never

/**
 * Utility type to parse an argument record into resolved argument values.
 */
type _ParsedArgs<T extends _Args> = {
  [K in keyof T]: _ParsedParam<T[K], true>
}

/**
 * Utility type to parse a flag record into resolved flag values.
 */
type _ParsedFlags<T extends _Flags> = {
  [K in keyof T]: _ParsedParam<T[K], false>
}

/**
 * Utility type to parse argument and flag record to a parsed argument and
 * flag record.
 */
export interface _Parsed<
  A extends _Args = _Args,
  F extends _Flags = _Flags,
  P extends Snippet[] = Snippet[],
> {
  /**
   * Parsed arguments.
   */
  readonly args: _ParsedArgs<NonNullable<A>> &
    _Merge<{
      [K in keyof P]: _ParsedArgs<NonNullable<P[K]['args']>>
    }>

  /**
   * Parsed flags.
   */
  readonly flags: _ParsedFlags<NonNullable<F>> &
    _Merge<{
      [K in keyof P]: _ParsedFlags<NonNullable<P[K]['flags']>>
    }>

  /**
   * Unknown arguments.
   */
  readonly unkArgs?: string[]

  /**
   * Unknown flags.
   */
  readonly unkFlags?: (string | boolean)[]
}

// MARK: - snippet

export interface Snippet<
  A extends _Args = _Args,
  F extends _Flags = _Flags,
> {
  /**
   * Arguments in the snippet.
   */
  readonly args?: A

  /**
   * Flags in the snippet.
   */
  readonly flags?: F
}

/**
 * Utility type to preserve snippet-level inference.
 */
export type _SnippetMap<T extends Snippet> = Snippet & {
  flags?: _Flags & _ParamMap<NonNullable<T['flags']>>
  args?: _Args & _ParamMap<NonNullable<T['args']>>
}

// MARK: - command

export type HandlerContext<
  A extends _Args,
  F extends _Flags,
  P extends Snippet[],
> = _Parsed<A, F, P> & {
  /**
   * Internal command scope. This is accessible for inspection and internal
   * commands, but is not a stable extension API.
   */
  readonly _: _ContextScope
}

/**
 * Schema and diagnostics available to the current command. `args` and
 * `flags` are definitions; parsed values remain on the outer context.
 */
export interface _ContextScope {
  readonly app: App
  readonly cmd: _Commands[string]
  readonly name: string
  readonly path: readonly string[]
  readonly args: _Args
  readonly flags: _Flags
  readonly sub: _Commands
  readonly collector: _Collector
  /**
   * Looks up a canonical or aliased path relative to this scope.
   */
  readonly resolve: (
    path: readonly string[],
  ) => _Result<_ContextScope, _Message>
}

/**
 * Any command specification that could appear in a sub-command record.
 *
 * The handler context is deliberately `unknown` because the exact parsed
 * argument and flag shapes differ per command; concrete handlers remain
 * assignable through bivariant parameter checking.
 */
type _AnyCommand = {
  /**
   * Alternative single-token names for this command.
   */
  readonly alias?: _Many<string>

  /**
   * Brief description of command.
   */
  readonly desc?: string

  /**
   * Arguments of the command.
   */
  readonly args?: _Args

  /**
   * Flags of the command.
   */
  readonly flags?: _Flags

  /**
   * Sub-commands of the command.
   */
  readonly sub?: _Commands

  /**
   * Snippets used in the command.
   */
  readonly use?: Snippet[]

  /**
   * Handler function of the command.
   */
  readonly handler?: {
    bivariance(ctx: unknown): void | Promise<void>
  }['bivariance']
}

/**
 * Record type for command specifications.
 */
export type _Commands = Record<string, _AnyCommand>

type _Handler<A extends _Args, F extends _Flags, P extends Snippet[]> = {
  bivariance(ctx: HandlerContext<A, F, P>): void | Promise<void>
}['bivariance']

/**
 * Command specification.
 */
export interface Command<
  A extends _Args = _Args,
  F extends _Flags = _Flags,
  C extends _Commands = _Commands,
  P extends Snippet[] = Snippet[],
> {
  /**
   * Alternative single-token names for this command.
   */
  readonly alias?: _Many<string>

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
   * Sub-commands of the command.
   */
  readonly sub?: C

  /**
   * Snippets used in the command.
   */
  readonly use?: P

  /**
   * Handler function of the command. Omit it for a command group whose
   * default action is to display generated help.
   */
  readonly handler?: _Handler<A, F, P>
}

// MARK: - app

/**
 * Low-level parser behavior toggles for uncommon CLI compatibility choices.
 */
export interface AppTweaks {
  /**
   * Parse `--no-name` as `--name=false` for Boolean flags.
   *
   * @default
   * `true`
   */
  readonly booleanNegation?: boolean

  /**
   * Parse `-abc` as `-a -b -c` when every member is a Boolean flag.
   *
   * @default
   * `true`
   */
  readonly shortBooleanClusters?: boolean

  /**
   * Read multiple values from one array flag occurrence.
   *
   * Supports whitespace and comma-separated forms such as `--name a b`,
   * `--name a,b`, and `--name a, b`.
   *
   * @default
   * `true`
   */
  readonly variadicFlagValues?: boolean

  /**
   * Treat negative numeric tokens as values for Number flags.
   *
   * @default
   * `true`
   */
  readonly negativeNumberValues?: boolean
}

/**
 * Vertin framework configuration.
 */
export interface AppConfig {
  /**
   * Built-in `-h`, `--help` and `help` command handling. Disable to reclaim
   * these names for application use.
   *
   * @default `true`
   */
  readonly help?: boolean

  /**
   * Built-in `-V` and `--version` handling when `ver` is provided.
   *
   * @default `true`
   */
  readonly version?: boolean

  /**
   * Low-level parser behavior toggles.
   */
  readonly tweaks?: AppTweaks
}

/**
 * Application specification.
 */
export interface App<C extends _Commands = _Commands> {
  /**
   * Brief description of the app.
   */
  readonly desc?: string

  /**
   * Version of the app.
   */
  readonly ver?: string

  /**
   * Global flags, available before and after subcommands. Command flags are
   * inherited by descendants; positional arguments remain local. Reuse a
   * snippet in a command for inference of shared flag values.
   */
  readonly flags?: _Flags

  /**
   * Main command of the app. Its flags join the root scope and are
   * inherited by subcommands; its arguments remain local.
   */
  readonly main?: _Commands[string]

  /**
   * Sub-commands of the app.
   */
  readonly sub?: C

  /**
   * Vertin framework configuration.
   */
  readonly config?: AppConfig
}

/**
 * Application specification returned by {@link app}.
 */
export interface RunnableApp<
  C extends _Commands = _Commands,
> extends App<C> {
  /**
   * Runs the application against the current process arguments.
   */
  readonly run: () => Promise<void>
}

// MARK: - utils

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

/**
 * Utility type to make a type include itself and a readonly array form.
 */
export type _Many<T> = T | readonly T[]

/**
 * Utility type to convert a union type to an intersection type.
 */
export type _Intersect<U> = (
  U extends unknown ? (x: U) => void : never
) extends (x: infer I) => void
  ? I
  : never

/**
 * Utility type to merge multiple objects into a single object.
 */
export type _Merge<T extends readonly object[]> =
  _Intersect<T[number]> extends infer O ? { [K in keyof O]: O[K] } : never
