/**
 * @license MIT
 * @file Shared parameter specifications and flag scopes.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import type {
  _Args,
  _Flags,
  _Message,
  _Result,
  Flag,
  Resolver,
  Snippet,
} from './types'
import { err, ok, to_array } from './utils'

export interface _Params {
  readonly args: _Args
  readonly flags: _Flags
}

/**
 * Resolves snippets within one command. Local fields take precedence.
 */
export function merge_params(
  cmd: Snippet & { readonly use?: Snippet[] },
): _Params {
  const args: _Args = {}
  const flags: _Flags = {}
  for (const part of cmd.use ?? []) {
    Object.assign(args, part.args)
    Object.assign(flags, part.flags)
  }
  Object.assign(args, cmd.args)
  Object.assign(flags, cmd.flags)
  return { args, flags }
}

/**
 * Extends a flag scope without silently shadowing inherited definitions.
 */
export function extend_flags(
  parent: _Flags,
  local: _Flags,
): _Result<_Flags, _Message> {
  for (const [key, flag] of Object.entries(local)) {
    if (Object.hasOwn(parent, key) && parent[key] !== flag) {
      return err({
        level: 'error',
        desc: 'Invalid flag schema',
        diag: {
          source: key,
          offset: 0,
          markup: `\`${key}\` is already defined in a parent scope`,
        },
      })
    }
  }
  return ok({ ...parent, ...local })
}

export function flag_names(key: string, flag: Flag): readonly string[] {
  return [
    `--${key}`,
    ...to_array(flag.alias ?? []).map((alias) =>
      alias.length === 1 ? `-${alias}` : `--${alias}`,
    ),
  ]
}

export function is_boolean(resolver: Resolver | undefined): boolean {
  return (Array.isArray(resolver) ? resolver[0] : resolver) === Boolean
}
