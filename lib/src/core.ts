/**
 * @license MIT
 * @file Command matching subsystem. This file resolves user input to the
 *   selected command context.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { invalid_command, no_command_specified } from './errors'
import type { _Commands, _Message, _Result, App } from './types'
import { err, ok } from './utils'

// MARK: - utils

const SINGLE_DASH = '-'

function is_flag(token: string | undefined): token is string {
  return token?.startsWith(SINGLE_DASH) === true && token !== SINGLE_DASH
}

function get_own<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string | undefined,
): T | undefined {
  if (!record || !key || !Object.hasOwn(record, key)) return undefined
  return record[key]
}

// MARK: - matching

/**
 * Resolves the command selected by the provided argv tokens.
 */
export function match(
  spec: App,
  argv: readonly string[],
  offset: number = 2,
): _Result<readonly [_Commands[string], number], _Message> {
  let token = argv[offset]

  if (is_flag(token)) {
    if (spec.main) {
      return ok([spec.main, offset])
    }
    return err(no_command_specified)
  }

  const subCommand = get_own(spec.sub, token)
  if (subCommand) {
    let cmd: _Commands[string] = subCommand
    offset += 1

    while (true) {
      token = argv[offset]
      const child = get_own<_Commands[string]>(cmd.sub, token)
      if (!child) {
        return ok([cmd, offset])
      }
      cmd = child
      offset += 1
    }
  }

  if (spec.main) {
    return ok([spec.main, offset])
  }

  if (token) {
    return err(invalid_command(argv, offset, token))
  }

  return err(no_command_specified)
}
