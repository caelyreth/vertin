/**
 * @file Command matching and parameter parsing subsystem.
 *
 * This file contains all core functions across the framework Vertin
 * to resolve user input into its corresponding context.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import type {
  _InternalCommands,
  App,
  Command,
  Message,
  Result,
} from './types'
import { INVALID_COMMAND, NO_COMMAND_SPECIFIED } from './errors'
import { Err, Ok } from './utils'

// MARK: - Command Matching

export function match(
  spec: App,
  argv: string[],
  internalCmds?: _InternalCommands,
): Result<[Command, string[]], Message[]> {
  // TODO: test for more runtime
  const sliced = argv.slice(2)

  let token = sliced[0]
  let offset = 2

  // check for flag, short flag and double dash
  if (token && token.startsWith('-')) {
    if (spec.main) {
      return Ok([spec.main, sliced])
    }
    if (internalCmds?.help) {
      return Ok([internalCmds.help, sliced])
    }
    return Err(NO_COMMAND_SPECIFIED)
  }

  if (token && spec.sub && token in spec.sub) {
    let cmd = spec.sub[token]
    sliced.shift()
    offset += 1

    while (true) {
      token = sliced[0]
      if (token && cmd.sub && token in cmd.sub) {
        cmd = cmd.sub[token]
        sliced.shift()
        offset += 1
      }
      else {
        return Ok([cmd, sliced])
      }
    }
  }

  if (spec.main) {
    return Ok([spec.main, sliced])
  }

  if (token) {
    return Err(INVALID_COMMAND(argv, offset, token))
  }

  return Err(NO_COMMAND_SPECIFIED)
}

// MARK: - Parameter Parsing
