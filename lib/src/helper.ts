import type { App } from './types/app'
import type { Command } from './types/command'
import type { _GetResolver, ArgumentRecord, FlagRecord } from './types/parameter'
import type { _Resolve } from './types/resolver'

/**
 * Helper function to create an record of argument parameters.
 */
export function arg<
  const T extends ArgumentRecord & {
    [K in keyof T]: Omit<T[K], 'fallback'> & {
      fallback?: NoInfer<_Resolve<_GetResolver<T[K]>>>
    }
  },
>(
  record: T,
): T {
  return record
}

/**
 * Helper function to create an record of flag parameters.
 */
export function flag<
  const T extends FlagRecord & {
    [K in keyof T]: Omit<T[K], 'fallback'> & {
      fallback?: NoInfer<_Resolve<_GetResolver<T[K]>>>
    }
  },
>(
  record: T,
): T {
  return record
}

/**
 * Helper function to create a command.
 */
export function cmd<
  const A extends ArgumentRecord & {
    [K in keyof A]: Omit<A[K], 'fallback'> & {
      fallback?: NoInfer<_Resolve<_GetResolver<A[K]>>>
    }
  },
  const F extends FlagRecord & {
    [K in keyof F]: Omit<F[K], 'fallback'> & {
      fallback?: NoInfer<_Resolve<_GetResolver<F[K]>>>
    }
  },
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
