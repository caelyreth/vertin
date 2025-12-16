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

import type { Styler } from './styler'

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
   * Prefix string before source line.
   */
  readonly prefix?: string

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

// MARK: - Deriver

/**
 * A __function__ that derives a dedicated type from raw value string
 *
 * You can use a custom function to parse a string into a _dedicated type_,
 * e.g. parsing from raw encoded input string to a decoded type,
 * so that we could utilize all _built-in features_ of Vertin with that type.
 */
export type FnDeriver<R = any> = (raw: string) => R

/**
 * Language's built-in constructor to derive their corresponding primitive
 * type from raw value string
 *
 * Vertin only support a subset of language's built-in constructor.
 * You can use {@link FnDeriver} to support other types in construction.
 *
 * @example
 * `String`, `Number`, `Boolean`
 */
export type CtorDeriver
  = | StringConstructor
    | NumberConstructor
    | BooleanConstructor

/**
 * A deriver is a __standard function__ or part of a language's built-in
 * __constructors__ used to derive a concrete type from raw value string.
 *
 * A {@link Deriver} is used for value __construction__, affecting the type of
 * value you could used from {@link HandlerContext}. Due to the same reason,
 * it is lack in displaying detailed messages in error messages and generating
 * good shell completion _(e.g. completion for a file extension, etc.)_
 *
 * If you want to make a better UX for your end user, consider using
 * `validate` API in the parameter specification to make better messages.
 *
 * In contrast, `derive` API in that specification is mainly for better DX.
 */
export type Deriver = FnDeriver | CtorDeriver | FnDeriver[] | CtorDeriver[]

/**
 * Utility type to extract the dervied type from a non-array deriver
 *
 * @private
 * @template T The deriver unit type to extract
 */
type _DeriveUnit<T>
  = T extends StringConstructor ? string
    : T extends NumberConstructor ? number
      : T extends BooleanConstructor ? boolean
        : T extends FnDeriver ? ReturnType<T>
          : never

/**
 * Utility type to extract the dervied type from any {@link Deriver}.
 *
 * @private
 * @template T Any kind of {@link Deriver} type to extract
 */
export type _Derive<T extends Deriver>
  = T extends readonly (infer U)[] ? _DeriveUnit<U>[]
    : T extends (infer U)[] ? _DeriveUnit<U>[]
      : _DeriveUnit<T>

// MARK: - Validator

/**
 * Working context of a validator
 */
export interface ValidatorContext<T> {
  /**
   * Raw value of current field
   */
  readonly value: T

  /**
   * Collector subsystem context
   */
  readonly collector: Collector
}

/**
 * Validate function to check if a value is valid
 *
 * A validator is used to __audit__ a value in runtime, affecting the UX
 * of end users in many aspects; it could be used to reduce boilerplate
 * runtime checking, producing comprehensive error messaging with Vertin's
 * un-throwable APIs and generating well shell completions.
 */
// TODO: return something to build shell completions.
export type Validator<T> = (ctx: ValidatorContext<T>) => void

// MARK: - Parameter

/**
 * Base parameter specification.
 *
 * @private
 * @template T {@link Deriver} used to parse raw string value.
 */
interface _BaseParameter<T extends Deriver = Deriver> {
  /**
   * {@link Deriver} used to parse raw string value.
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
  readonly fallback?: _Derive<T>

  /**
   * Constraint function to check if the parameter is valid.
   */
  readonly constr?: Validator<_Derive<T>>
}

/**
 * Argument parameter specification.
 *
 * @template T {@link Deriver} used to parse the raw string value.
 */
export interface Argument<T extends Deriver = Deriver> extends _BaseParameter<T> {
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
 * @template T {@link Deriver} used to parse raw string value.
 */
export interface Flag<T extends Deriver = Deriver> extends _BaseParameter<T> {
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
 * Record type for argument and argument specifications.
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

  /**
   * Tint color of the flag section.
   */
  readonly styler?: Styler

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
export type _GetResolver<T extends Argument> = T['resolver'] extends Deriver
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
    fallback?: NoInfer<_Derive<_GetResolver<T[K]>>>
    constr?: Validator<NoInfer<_Derive<_GetResolver<T[K]>>>>
  }
}

/**
 * Utility type to map a flag record into flag section.
 *
 * @private
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
  [K in keyof T]: T[K]['fallback'] extends _Derive<_GetResolver<T[K]>>
    ? _Derive<_GetResolver<T[K]>>
    : T[K]['optional'] extends true ? _Derive<_GetResolver<T[K]>> | undefined
      : _Derive<_GetResolver<T[K]>>
}

/**
 * Utility type to parse flag record to a parsed flag record.
 */
type _ParsedFlagRecord<
  T extends FlagRecord,
> = {
  [K in keyof T]: T[K]['fallback'] extends _Derive<_GetResolver<T[K]>>
    ? _Derive<_GetResolver<T[K]>>
    : T[K]['required'] extends true ? _Derive<_GetResolver<T[K]>>
      : _Derive<_GetResolver<T[K]>> | undefined
}

/**
 * Utility type to parse argument and flag record to a parsed argument and flag record.
 */
export interface _Parsed<
  A extends ArgumentRecord = ArgumentRecord,
  F extends FlagRecord = FlagRecord,
  P extends Snippet[] = Snippet[],
> {
  /**
   * Parsed arguments.
   */
  readonly args: _ParsedArgument<NonNullable<A>>
    & MergeObjects<{
      [K in keyof P]: _ParsedArgument<NonNullable<P[K]['args']>>
    }>

  /**
   * Parsed flags.
   */
  readonly flags: _ParsedFlagRecord<NonNullable<F>>
    & MergeObjects<{
      [K in keyof P]: _ParsedFlagRecord<NonNullable<P[K]['flags']>>
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

// MARK: - Snippet

/**
 *
 */
export interface Snippet<
  A extends ArgumentRecord = ArgumentRecord,
  F extends FlagRecord = FlagRecord,
  S extends FlagSection[] = FlagSection[],
> {
  /**
   * Arguments in the snippet.
   */
  readonly args?: A

  /**
   * Flags in the snippet.
   */
  readonly flags?: F

  /**
   * Sections of flags in the snippet.
   */
  readonly sections?: S
}

/**
 * @private
 */
export type _SnippetMap<T extends Snippet> = Snippet & {
  flags?: FlagRecord & _ParameterMap<NonNullable<T['flags']>>
  args?: ArgumentRecord & _ParameterMap<NonNullable<T['args']>>
  sections?: _FlagSectionsMap<NonNullable<T['sections']>, NonNullable<T['flags']>>
}

// MARK: - Command

export type HandlerContext<
  A extends ArgumentRecord,
  F extends FlagRecord,
  P extends Snippet[],
> = _Parsed<A, F, P> & {
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
 * Record type for argument and command specifications.
 */
export type CommandRecord = Record<string, Command>

/**
 * Command specification.
 */
export interface Command<
  A extends ArgumentRecord = ArgumentRecord,
  F extends FlagRecord = FlagRecord,
  S extends FlagSection[] = FlagSection[],
  C extends CommandRecord = CommandRecord,
  G extends CommandCategory[] = CommandCategory[],
  P extends Snippet[] = Snippet[],
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
  readonly sub?: C

  /**
   * Command category grouping.
   */
  readonly categories?: G

  /**
   * Snippets used in the command.
   */
  readonly use?: P

  /**
   * Handler function of the command.
   *
   * @todo complete handler system, currently it's just a placeholder.
   */
  readonly handler: (ctx: HandlerContext<A, F, P>) => void
}

/**
 *
 */
export interface CommandCategory<T extends CommandRecord = CommandRecord> {
  /**
   * Brief description of the command category.
   */
  readonly desc?: string

  /**
   * Tint color of the command category.
   */
  readonly styler?: Styler

  // TODO!: add more features to category grouping

  /**
   * Flags in the command category.
   */
  readonly cmds: (keyof T)[]
}

/**
 * Utility type to map a command record into category section.
 *
 * @private
 */
export type _CommandCategoriesMap<S extends CommandCategory[], C extends CommandRecord> = {
  [K in keyof S]: S[K] extends CommandCategory
    ? CommandCategory<C>
    : never
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
export interface App<
  C extends CommandRecord = CommandRecord,
  G extends CommandCategory[] = CommandCategory[],
> {
  /**
   * Brief description of the app.
   */
  readonly desc?: string

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
  readonly sub?: C

  /**
   * Command category grouping.
   */
  readonly categories?: G

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
