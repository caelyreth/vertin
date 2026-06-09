/**
 * @file Helper functions to create specifications.
 *
 * Vertin uses a spec-first pattern, these helper functions are used to
 * create specifications easily with type inference.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import type {
  _Args,
  _Commands,
  _Flags,
  _ParamMap,
  _SnippetMap,
  App,
  Command,
  Message,
  Snippet,
  Validator,
} from './types'

// MARK: - Subsystem

/** Helper function to create a typed message. */
export function msg<T extends Message>(message: T): T {
  return message
}

/** Helper function to create a constraint. */
export function constr<T>(validator: Validator<T>): Validator<T> {
  return validator
}

// MARK: - Parameter

/** Helper function to create a record of argument parameters. */
export function args<const T extends _Args & _ParamMap<T>>(record: T): T {
  return record
}

/** Helper function to create a record of flag parameters. */
export function flags<const T extends _Flags & _ParamMap<T>>(record: T): T {
  return record
}

// MARK: - Snippet

/** Helper function to create a reusable parameter specification. */
export function snippet<const T extends Snippet & _SnippetMap<T>>(
  records: T,
): T {
  return records
}

// MARK: - Command

/** Helper function to create a command. */
export function cmd<
  const A extends _Args & _ParamMap<A>,
  const F extends _Flags & _ParamMap<F>,
  const C extends _Commands,
  const P extends Snippet[],
>(
  spec: Omit<Command<A, F, C, P>, 'handler'> & {
    readonly args?: A
    readonly flags?: F
    readonly sub?: C
    readonly use?: P
  },
  handler: Command<A, F, C, P>['handler'],
): Command<A, F, C, P> {
  return {
    ...spec,
    handler,
  }
}

// MARK: - App

/** Helper function to create an application. */
export function app<const C extends _Commands>(
  spec: Omit<App<C>, 'config'> & {
    readonly sub?: C
  },
  config?: App<C>['config'],
): App<C> {
  return {
    ...spec,
    config,
  }
}
