import type { _GetResolver, Argument, Flag } from './types/parameter'
import type { _Resolve } from './types/resolver'

/**
 * Helper function to create an record of argument parameters.
 */
export function arg<
  const T extends Record<string, Argument>,
>(
  record: {
    [K in keyof T]: T[K] & {
      fallback?: NoInfer<_Resolve<_GetResolver<T[K]>>>
    }
  },
): T {
  return record
}

/**
 * Helper function to create an record of flag parameters.
 */
export function flag<
  const T extends Record<string, Flag>,
>(
  record: {
    [K in keyof T]: T[K] & {
      fallback?: NoInfer<_Resolve<_GetResolver<T[K]>>>
    }
  },
): T {
  return record
}
