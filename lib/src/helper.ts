/**
 * @license MIT
 * @file Helper functions to create specifications. Vertin uses a spec-first
 *   pattern, these helper functions are used to create specifications
 *   easily with type inference.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { run as run_app } from './app'
import type {
  _Args,
  _Commands,
  _Flags,
  _ParamMap,
  _SnippetMap,
  App,
  Check,
  Command,
  RunnableApp,
  Snippet,
} from './types'

/**
 * Helper function to create a check.
 */
export function check<T>(fn: Check<T>): Check<T> {
  return fn
}

/**
 * Helper function to create a record of argument parameters.
 */
export function args<const T extends _Args & _ParamMap<T>>(record: T): T {
  return record
}

/**
 * Helper function to create a record of flag parameters.
 */
export function flags<const T extends _Flags & _ParamMap<T>>(record: T): T {
  return record
}

/**
 * Helper function to create a reusable parameter specification.
 */
export function snippet<const T extends Snippet & _SnippetMap<T>>(
  records: T,
): T {
  return records
}

/**
 * Helper function to create a command.
 */
export function cmd<
  const A extends _Args = {},
  const F extends _Flags = {},
  const C extends _Commands = {},
  const P extends Snippet[] = [],
>(
  spec: Omit<Command<A, F, C, P>, 'handler'> & {
    readonly args?: A
    readonly flags?: F
    readonly sub?: C
    readonly use?: P
  },
  handler?: Command<A, F, C, P>['handler'],
): Command<A, F, C, P> {
  return {
    ...spec,
    handler,
  }
}

/**
 * Helper function to create an application.
 */
export function app<const C extends _Commands>(
  spec: Omit<App<C>, 'config'> & {
    readonly sub?: C
  },
  config?: App<C>['config'],
): RunnableApp<C> {
  const created = {
    ...spec,
    config,
  } as App<C>
  return {
    ...created,
    run: () => run_app(created),
  }
}
