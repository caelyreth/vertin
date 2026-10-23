/**
 * @license MIT
 * @file Utility functions across Vertin framework. This file contains all
 *   utility functions across the framework Vertin.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
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

// MARK: - conversion

export function to_array<T>(value: _Many<T>): readonly T[] {
  return Array.isArray(value) ? value : [value as T]
}
