/**
 * @license MIT
 * @file Command matching and inherited option scopes.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { builtin_flags } from './builtins'
import { invalid_command } from './errors'
import {
  extend_flags,
  flag_names,
  is_boolean,
  merge_params,
} from './schema'
import type {
  _Commands,
  _Flags,
  _Message,
  _Result,
  App,
  Flag,
} from './types'
import { err, is_err, ok, to_array } from './utils'

export interface _Match {
  readonly cmd: _Commands[string]
  readonly offset: number
  readonly path: readonly string[]
  readonly commands: readonly number[]
  readonly flags: _Flags
  readonly help?: boolean
}

// MARK: - names

function register_name(
  names: Map<string, string>,
  name: string,
  key: string,
): _Message | undefined {
  if (!name || name.startsWith('-') || /\s/.test(name)) {
    return {
      level: 'error',
      desc: 'Invalid command schema',
      diag: {
        source: name,
        offset: 0,
        markup:
          'Command names must be nonempty tokens without a leading `-`',
      },
    }
  }
  const existing = names.get(name)
  if (existing !== undefined && existing !== key) {
    return {
      level: 'error',
      desc: 'Invalid command schema',
      diag: {
        source: name,
        offset: 0,
        markup: `\`${name}\` is already used by \`${existing}\``,
      },
    }
  }
  names.set(name, key)
  return undefined
}

/**
 * Maps canonical names and aliases to sibling command keys.
 */
export function command_names(
  commands: _Commands = {},
): _Result<ReadonlyMap<string, string>, _Message> {
  const names = new Map<string, string>()
  for (const key of Object.keys(commands)) {
    const failure = register_name(names, key, key)
    if (failure) return err(failure)
  }
  for (const [key, cmd] of Object.entries(commands)) {
    for (const alias of to_array(cmd.alias ?? [])) {
      const failure = register_name(names, alias, key)
      if (failure) return err(failure)
    }
  }
  return ok(names)
}

// MARK: - option boundaries

function is_flag(token: string): boolean {
  return token !== '-' && token.startsWith('-')
}

function find_flag(
  flags: _Flags,
  name: string,
  spec: App,
): Flag | undefined {
  const direct = Object.entries(flags).find(([key, flag]) =>
    flag_names(key, flag).includes(name),
  )?.[1]
  if (direct || spec.config?.tweaks?.booleanNegation === false) {
    return direct
  }
  if (!name.startsWith('--no-')) return undefined
  const flag = find_flag(flags, `--${name.slice(5)}`, spec)
  return flag && is_boolean(flag.resolver)
    ? { resolver: Boolean }
    : undefined
}

function readable(
  token: string | undefined,
  flag: Flag,
  spec: App,
): token is string {
  if (token === undefined || token === '--') return false
  if (!token.startsWith('-') || token === '-') return true
  if (spec.config?.tweaks?.negativeNumberValues === false) return false
  const resolver = Array.isArray(flag.resolver)
    ? flag.resolver[0]
    : flag.resolver
  return (
    resolver === Number &&
    token.split(',').every((part) => !Number.isNaN(Number(part)))
  )
}

function array_flag_end(
  argv: readonly string[],
  offset: number,
  flag: Flag,
  names: ReadonlyMap<string, string>,
  spec: App,
): number {
  const inline = argv[offset]!.includes('=')
  let end = offset + 1
  const comma = inline || argv[end]?.includes(',') === true
  if (inline && !argv[offset]!.endsWith(',')) return end
  while (readable(argv[end], flag, spec) && !names.has(argv[end]!)) {
    const token = argv[end]!
    end += 1
    if (comma && !token.endsWith(',')) break
  }
  return end
}

function flag_end(
  argv: readonly string[],
  offset: number,
  flag: Flag | undefined,
  names: ReadonlyMap<string, string>,
  spec: App,
): number {
  if (!flag || is_boolean(flag.resolver)) return offset + 1
  if (
    Array.isArray(flag.resolver) &&
    spec.config?.tweaks?.variadicFlagValues !== false
  ) {
    return array_flag_end(argv, offset, flag, names, spec)
  }
  if (argv[offset]!.includes('=')) return offset + 1
  return readable(argv[offset + 1], flag, spec) ? offset + 2 : offset + 1
}

// MARK: - matching

interface _Route {
  cmd?: _Commands[string]
  sub?: _Commands
  flags: _Flags
  path: string[]
  commands: number[]
  help?: boolean
}

function option_offset(
  spec: App,
  argv: readonly string[],
  offset: number,
  route: _Route,
  names: ReadonlyMap<string, string>,
): number | undefined {
  const flag = find_flag(route.flags, argv[offset]!.split('=')[0]!, spec)
  if (!route.cmd && spec.main && !flag) return undefined
  return flag_end(argv, offset, flag, names, spec)
}

function select_command(
  route: _Route,
  token: string,
  offset: number,
  names: ReadonlyMap<string, string>,
  spec: App,
): _Result<boolean, _Message> {
  if (token === 'help' && spec.config?.help !== false) {
    route.help = true
    route.commands.push(offset)
    return ok(true)
  }
  const key = names.get(token)
  if (key === undefined) return ok(false)
  const cmd = route.sub![key]!
  const inherited = extend_flags(route.flags, merge_params(cmd).flags)
  if (is_err(inherited)) return inherited
  route.cmd = cmd
  route.flags = inherited.value
  route.path.push(key)
  route.commands.push(offset)
  route.sub = cmd.sub
  return ok(true)
}

function scope_names(
  sub: _Commands,
  spec: App,
): _Result<ReadonlyMap<string, string>, _Message> {
  const names = command_names(sub)
  if (is_err(names)) return names
  if (spec.config?.help !== false && names.value.has('help')) {
    return err({
      level: 'error',
      desc: 'Invalid command schema',
      diag: {
        source: 'help',
        offset: 0,
        markup: '`help` is reserved; disable built-in help to reclaim it',
      },
    })
  }
  return names
}

function match_subcommands(
  spec: App,
  argv: readonly string[],
  offset: number,
  route: _Route,
): _Result<number, _Message> {
  while (route.sub) {
    const names = scope_names(route.sub, spec)
    if (is_err(names)) return names
    const token = argv[offset]
    if (token === undefined || token === '--') break
    if (is_flag(token)) {
      const next = option_offset(spec, argv, offset, route, names.value)
      if (next === undefined) break
      offset = next
      continue
    }
    const selected = select_command(route, token, offset, names.value, spec)
    if (is_err(selected)) return selected
    if (!selected.value) break
    offset += 1
  }
  return ok(offset)
}

/**
 * Selects a command while preserving original argv positions for
 * diagnostics.
 */
export function match(
  spec: App,
  argv: readonly string[],
  offset: number = 2,
): _Result<_Match, _Message> {
  const rootFlags = extend_flags(spec.flags ?? {}, builtin_flags(spec))
  if (is_err(rootFlags)) return rootFlags
  const route: _Route = {
    sub: spec.sub,
    flags: rootFlags.value,
    path: [],
    commands: [],
  }
  const end = match_subcommands(spec, argv, offset, route)
  if (is_err(end)) return end
  if (route.cmd) {
    const token = argv[end.value]
    if (!route.cmd.handler && token && !is_flag(token)) {
      return err(invalid_command(argv, end.value, token))
    }
    return ok({
      cmd: route.cmd,
      offset: end.value,
      path: route.path,
      commands: route.commands,
      flags: route.flags,
      help: route.help,
    })
  }
  return match_main(spec, argv, end.value, route)
}

function match_main(
  spec: App,
  argv: readonly string[],
  offset: number,
  route: _Route,
): _Result<_Match, _Message> {
  if (spec.main) {
    const flags = extend_flags(route.flags, merge_params(spec.main).flags)
    if (is_err(flags)) return flags
    return ok({
      cmd: spec.main,
      offset,
      path: [],
      commands: route.commands,
      flags: flags.value,
      help: route.help,
    })
  }
  const token = argv[offset]
  if (token && !is_flag(token)) {
    return err(invalid_command(argv, offset, token))
  }
  return ok({
    cmd: { desc: spec.desc, sub: spec.sub },
    offset,
    path: [],
    commands: route.commands,
    flags: route.flags,
    help: route.help,
  })
}
