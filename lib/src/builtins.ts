/**
 * @license MIT
 * @file Built-in informational options.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import type { _Flags, App, Flag } from './types'

export type _Builtin = 'help'

const help_flag: Flag = { alias: 'h', resolver: Boolean, desc: 'Show help' }

export function builtin_flags(spec: App): _Flags {
  return spec.config?.help === false ? {} : { help: help_flag }
}

export function requested_builtin(
  spec: App,
  values: Readonly<Record<string, readonly { readonly value: string }[]>>,
): _Builtin | undefined {
  const value = values.help?.at(-1)?.value
  if (spec.config?.help !== false && (value === 'true' || value === '1')) {
    return 'help'
  }
  return undefined
}
