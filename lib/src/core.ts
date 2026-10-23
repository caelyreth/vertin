/**
 * @license MIT
 * @file Command matching subsystem. This file resolves user input to the
 *   selected command context.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { invalid_command, no_command_specified } from './errors'
import type { _Commands, _Message, _Result, App } from './types'
import { err, is_err, ok, to_array } from './utils'

// MARK: - utils

const SINGLE_DASH = '-'

function is_flag(token: string | undefined): token is string {
  return token?.startsWith(SINGLE_DASH) === true && token !== SINGLE_DASH
}

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

function find_command(
  commands: _Commands | undefined,
  token: string | undefined,
): _Result<_Commands[string] | undefined, _Message> {
  const names = command_names(commands)
  if (is_err(names)) return names
  const key = names.value.get(token ?? '')
  return ok(key === undefined ? undefined : commands![key])
}

// MARK: - matching

function match_children(
  cmd: _Commands[string],
  argv: readonly string[],
  offset: number,
): _Result<readonly [_Commands[string], number], _Message> {
  while (true) {
    const child = find_command(cmd.sub, argv[offset])
    if (is_err(child)) return child
    if (!child.value) return ok([cmd, offset])
    cmd = child.value
    offset += 1
  }
}

/**
 * Resolves the command selected by the provided argv tokens.
 */
export function match(
  spec: App,
  argv: readonly string[],
  offset: number = 2,
): _Result<readonly [_Commands[string], number], _Message> {
  const token = argv[offset]

  if (is_flag(token)) {
    if (spec.main) {
      return ok([spec.main, offset])
    }
    return err(no_command_specified)
  }

  const subCommand = find_command(spec.sub, token)
  if (is_err(subCommand)) return subCommand
  if (subCommand.value) {
    return match_children(subCommand.value, argv, offset + 1)
  }

  if (spec.main) {
    return ok([spec.main, offset])
  }

  if (token) {
    return err(invalid_command(argv, offset, token))
  }

  return err(no_command_specified)
}
