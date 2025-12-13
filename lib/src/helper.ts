import type { App } from './types/app'
import type { Command } from './types/command'
import type { Constraint } from './types/constraint'
import type { _ParameterMap, ArgumentRecord, FlagRecord } from './types/parameter'

/**
 * Helper function to create a constraint.
 */
export function constr<T>(
  validator: Constraint<T>,
): Constraint<T> {
  return validator
}

/**
 * Helper function to create an record of argument parameters.
 */
export function arg<
  const T extends ArgumentRecord & _ParameterMap<T>,
>(
  record: T,
): T {
  return record
}

/**
 * Helper function to create an record of flag parameters.
 */
export function flag<
  const T extends FlagRecord & _ParameterMap<T>,
>(
  record: T,
): T {
  return record
}

/**
 * Helper function to create a command.
 */
export function cmd<
  const A extends ArgumentRecord & _ParameterMap<A>,
  const F extends FlagRecord & _ParameterMap<F>,
>(
  spec: Omit<Command<A, F>, 'handler'> & {
    args?: A
    flags?: F
  },
  handler: Command<A, F>['handler'],
): Command<A, F> {
  return {
    ...spec,
    handler,
  }
}

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
