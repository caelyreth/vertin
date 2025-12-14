/**
 * @file Utility functions across Vertin framework.
 *
 * This file contains all utility functions across the framework Vertin.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import type { Failure, Result, Success } from './types'

// MARK: - Result

/**
 * Helper function to create s success result.
 *
 * @param value Returned success value.
 */
export function Ok<T>(value: T): Success<T> {
  return {
    success: true,
    value,
  }
}

/**
 * Helper function to create s failure result.
 *
 * @param errors Returned error value(s).
 */
export function Err<E>(errors: E | E[]): Failure<E[]> {
  return {
    success: false,
    errors: Array.isArray(errors) ? errors : [errors],
  }
}

/**
 * Type guard to check if the result is a success (Success<T>).
 *
 * @param result The result to check.
 */
export function isOk<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true
}

/**
 * Type guard to check if the result is a failure (Failure<E>).
 *
 * @param result The result to check.
 */
export function isErr<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false
}

/**
 * Maps a function over the success value.
 *
 * If the result is Ok<T>, applies the mapper function to T to produce U,
 * returning Ok<U>. If the result is Failure<E>, returns Failure<E> unchanged.
 *
 * @param result The result to map over.
 * @param mapper The mapping function to apply to the success value.
 */
export function mapOk<T, E, U>(
  result: Result<T, E>,
  mapper: (value: T) => U,
): Result<U, E> {
  if (result.success) {
    return Ok(mapper(result.value))
  }
  return result
}

/**
 * Maps a function over the error value.
 *
 * If the result is Failure<E>, applies the mapper function to E to produce F,
 * returning Failure<F>. If the result is Success<T>, returns Success<T> unchanged.
 *
 * @param result The result to map over.
 * @param mapper The mapping function to apply to the error value.
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  mapper: (errors: E) => F,
): Result<T, F> {
  if (!result.success) {
    return Err(mapper(result.errors)) as Failure<F>
  }
  return result
}

/**
 * Returns the inner success value if the result is Ok<T>.
 * Otherwise, returns the provided default value.
 *
 * @param result The result to unwrap.
 * @param fallback The default value to return if the result is a failure.
 */
export function unwrapOr<T, E>(result: Result<T, E>, fallback: T): T {
  if (result.success) {
    return result.value
  }
  return fallback
}
