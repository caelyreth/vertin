/**
 * @file Helper functions to create specifications.
 *
 * Vertin uses a spec-first pattern, these helper functions are used to
 * create specifications easily with type inference.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import type {
  _FlagSectionsMap,
  _ParameterMap,
  App,
  ArgumentRecord,
  Command,
  Constraint,
  FlagRecord,
  FlagSection,
  Message,
} from './types'

// MARK: - Subsystem

/**
 *
 */
export function msg<T extends Message>(
  message: T,
): T {
  return message
}

/**
 * Helper function to create a constraint.
 */
export function constr<T>(
  validator: Constraint<T>,
): Constraint<T> {
  return validator
}

// MARK: - Parameter

/**
 * Helper function to create an record of argument parameters.
 */
export function args<
  const T extends ArgumentRecord & _ParameterMap<T>,
>(
  record: T,
): T {
  return record
}

/**
 * Helper function to create an record of flag parameters.
 */
export function flags<
  const T extends FlagRecord & _ParameterMap<T>,
>(
  record: T,
): T {
  return record
}

// MARK: - Command

/**
 * Helper function to create a command.
 */
export function cmd<
  const A extends ArgumentRecord & _ParameterMap<A>,
  const F extends FlagRecord & _ParameterMap<F>,
  const S extends FlagSection[] & _FlagSectionsMap<S, F>,
>(
  spec: Omit<Command<A, F, S>, 'handler'> & {
    args?: A
    flags?: F
    sections?: S
  },
  handler: Command<A, F, S>['handler'],
): Command<A, F, S> {
  return {
    ...spec,
    handler,
  }
}

// MARK: - App

/**
 * Helper function to create an application.
 */
export function app(
  spec: Omit<App, 'config'>,
  config?: App['config'],
): App {
  return {
    ...spec,
    config,
  }
}
