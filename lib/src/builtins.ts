/**
 * @license MIT
 * @file Built-in informational options.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import type { _Flags, App, Flag } from './types'

export type _Builtin = 'help' | 'version'

const help_flag: Flag = { alias: 'h', resolver: Boolean, desc: 'Show help' }

const version_flag: Flag = {
  alias: 'V',
  resolver: Boolean,
  desc: 'Show version',
}

export function builtin_flags(spec: App): _Flags {
  const flags: _Flags =
    spec.config?.help === false ? {} : { help: help_flag }
  if (spec.ver !== undefined && spec.config?.version !== false) {
    flags.version = version_flag
  }
  return flags
}

export function requested_builtin(
  spec: App,
  values: Readonly<Record<string, readonly { readonly value: string }[]>>,
): _Builtin | undefined {
  const flags = builtin_flags(spec)
  for (const key of ['help', 'version'] as const) {
    const value = values[key]?.at(-1)?.value
    if (Object.hasOwn(flags, key) && (value === 'true' || value === '1')) {
      return key
    }
  }
  return undefined
}
