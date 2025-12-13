import type { _Resolve, Resolver } from './resolver'
import type { _KeyCount } from './utils'

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
  [K in keyof T]: Omit<T[K], 'fallback'> & {
    fallback?: NoInfer<_Resolve<_GetResolver<T[K]>>>
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
    : _KeyCount<NonNullable<A>> extends 0 ? never
      : _ParsedArgument<NonNullable<A>>

  flags: F extends undefined ? never
    : _KeyCount<NonNullable<A>> extends 0 ? never
      : _ParsedFlag<NonNullable<A>>

  // TODO: unknown flags and arguments
}
