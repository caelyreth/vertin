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
  _ArgsInput,
  _Commands,
  _FlagsInput,
  _ParamGuard,
  _SnippetInput,
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
 * Creates a reusable argument record. Inline `cmd` records use the same
 * inference and validation; this helper is optional.
 */
export function args<const T extends _ArgsInput>(
  record: T & _ArgsInput & NoInfer<_ParamGuard<T>>,
): T {
  return record
}

/**
 * Creates a reusable flag record. Inline `cmd` and `app` records use the
 * same inference and validation; this helper is optional.
 */
export function flags<const T extends _FlagsInput>(
  record: T & _FlagsInput & NoInfer<_ParamGuard<T>>,
): T {
  return record
}

/**
 * Helper function to create a reusable parameter specification.
 */
export function snippet<const T extends _SnippetInput>(
  records: T & _SnippetInput & NoInfer<_SnippetMap<T>>,
): T {
  return records
}

/**
 * Helper function to create a command.
 */
export function cmd<
  const A extends _ArgsInput = {},
  const F extends _FlagsInput = {},
  const C extends _Commands = {},
  const P extends Snippet[] = [],
>(
  spec: Omit<Command<A, F, C, P>, 'handler' | 'args' | 'flags'> & {
    readonly args?: A & _ArgsInput & NoInfer<_ParamGuard<A>>
    readonly flags?: F & _FlagsInput & NoInfer<_ParamGuard<F>>
    readonly sub?: C
    readonly use?: P
  },
  handler?: NoInfer<Command<A, F, C, P>['handler']>,
): Command<A, F, C, P> {
  return {
    ...spec,
    handler,
  }
}

/**
 * Helper function to create an application.
 */
export function app<
  const C extends _Commands = {},
  const F extends _FlagsInput = {},
>(
  spec: Omit<App<C, F>, 'config' | 'flags'> & {
    readonly sub?: C
    readonly flags?: F & _FlagsInput & NoInfer<_ParamGuard<F>>
  },
  config?: App<C, F>['config'],
): RunnableApp<C, F> {
  const created = {
    ...spec,
    config,
  } as App<C, F>
  return {
    ...created,
    run: () => run_app(created),
  }
}
