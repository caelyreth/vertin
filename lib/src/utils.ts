/**
 * @file Utility functions across Vertin framework.
 *
 * This file contains all utility functions across the framework Vertin.
 *
 * @copyright Yu 2026
 * @author Yu <me@iki.moe>
 * @license MIT
 */

import type { _Err, _Many, _Ok, _Result } from './types'

// MARK: - Result

/**
 * Creates a success result.
 *
 * @param value Returned success value.
 */
export function ok<T>(value: T): _Ok<T> {
  return {
    success: true,
    value,
  }
}

/**
 * Creates a failure result.
 *
 * @param errors Returned error value(s).
 */
export function err<E>(errors: E): _Err<E> {
  return {
    success: false,
    errors,
  }
}

/**
 * Type guard to check if the result is a success.
 *
 * @param result The result to check.
 */
export function is_ok<T, E>(result: _Result<T, E>): result is _Ok<T> {
  return result.success === true
}

/**
 * Type guard to check if the result is a failure.
 *
 * @param result The result to check.
 */
export function is_err<T, E>(result: _Result<T, E>): result is _Err<E> {
  return result.success === false
}

/**
 * Maps a function over the success value.
 *
 * If the result is ok, applies the mapper function to its value. Otherwise,
 * returns the error unchanged.
 *
 * @param result The result to map over.
 * @param mapper The mapping function to apply to the success value.
 */
export function map_ok<T, E, U>(
  result: _Result<T, E>,
  mapper: (value: T) => U,
): _Result<U, E> {
  if (result.success) {
    return ok(mapper(result.value))
  }
  return result
}

/**
 * Maps a function over the error value.
 *
 * If the result is an error, applies the mapper function to its value.
 * Otherwise, returns the success unchanged.
 *
 * @param result The result to map over.
 * @param mapper The mapping function to apply to the error value.
 */
export function map_err<T, E, F>(
  result: _Result<T, E>,
  mapper: (errors: E) => F,
): _Result<T, F> {
  if (!result.success) {
    return err(mapper(result.errors)) as _Err<F>
  }
  return result
}

/**
 * Returns the inner success value, or the provided fallback for errors.
 *
 * @param result The result to unwrap.
 * @param fallback The default value to return if the result is a failure.
 */
export function unwrap_or<T, E>(result: _Result<T, E>, fallback: T): T {
  if (result.success) {
    return result.value
  }
  return fallback
}

// MARK: - conversion

export function to_array<T>(value: _Many<T>): readonly T[] {
  return Array.isArray(value) ? value : [value as T]
}
