import type { _Resolve, Resolver } from './resolver'

/**
 * Argument parameter specification.
 *
 * @template T Resolver used to parse the raw string value.
 */
export interface Argument<T extends Resolver = Resolver> {
  /**
   * {@link Resolver} used to parse raw string value.
   *
   * @default
   * `String`
   */
  readonly type?: T

  /**
   * Brief description of argument parameter.
   */
  readonly desc?: string

  /**
   * Whether the argument field is optional.
   *
   * @default false
   */
  readonly optional?: boolean

  /**
   * Fallback value if argument field omitted.
   */
  readonly fallback?: _Resolve<T>
}

/**
 * Flag parameter specification.
 *
 * @template T {@link Resolver} used to parse raw string value.
 */
export interface Flag<T extends Resolver = Resolver> {
  /**
   * {@link Resolver} used to parse raw string value.
   *
   * @default
   * `String`
   */
  readonly type?: T

  /**
   * Brief description of argument parameter.
   */
  readonly desc?: string

  /**
   * Whether the flag field is required.
   *
   * @default false
   */
  readonly required?: boolean

  /**
   * Fallback value if flag field omitted.
   */
  readonly fallback?: _Resolve<T>

  /**
   * Alias for the flag field.
   *
   * A single character string will become a single dash prefixed flag,
   * while a multi-character string will become a double dash prefixed flag.
   */
  readonly alias?: string | string[]
}

/**
 * Utility type to extract resolver type from an parameter specification.
 * It's used to implement the default string resolver inference.
 *
 * @private
 */
export type _GetResolver<T extends Argument> = T['type'] extends Resolver
  ? T['type']
  : StringConstructor
