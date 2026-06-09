/**
 * @file Command matching and parameter parsing subsystem.
 *
 * This file contains all core functions across the framework
 * to resolve user input into its corresponding context.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import { INVALID_COMMAND, NO_COMMAND_SPECIFIED } from './errors'
import type {
  App,
  Command,
  CtorDeriver,
  FnDeriver,
  Message,
  Result,
} from './types'
import { Err, Ok } from './utils'

// MARK: - Constants & Utilities

const SINGLE_DASH = '-'

function isFlag(token: string | undefined): token is string {
  return token?.startsWith(SINGLE_DASH) ?? false
}

function getOwn<T>(
  record: Readonly<Record<string, T>> | undefined,
  key: string | undefined,
): T | undefined {
  if (!record || !key || !Object.hasOwn(record, key)) return undefined
  return record[key]
}

// MARK: - Command Matching

/** Resolves the command selected by the provided argv tokens. */
export function match(
  spec: App,
  argv: readonly string[],
  offset: number = 2,
): Result<readonly [Command, number], Message> {
  let token = argv[offset]

  if (isFlag(token)) {
    if (spec.main) {
      return Ok([spec.main, offset])
    }
    return Err(NO_COMMAND_SPECIFIED)
  }

  const subCommand = getOwn(spec.sub, token)
  if (subCommand) {
    let cmd = subCommand
    offset += 1

    while (true) {
      token = argv[offset]
      const child = getOwn(cmd.sub, token)
      if (!child) {
        return Ok([cmd, offset])
      }
      cmd = child
      offset += 1
    }
  }

  if (spec.main) {
    return Ok([spec.main, offset])
  }

  if (token) {
    return Err(INVALID_COMMAND(Array.from(argv), offset, token))
  }

  return Err(NO_COMMAND_SPECIFIED)
}

// MARK: - Value Resolution

/** Resolves a raw value with a scalar resolver. */
function _resolve(
  value: string,
  resolver: FnDeriver | CtorDeriver = String,
): Result<unknown, string> {
  if (resolver === String) return Ok(value)
  if (resolver === Number) {
    const resolved = Number(value)
    if (Number.isNaN(resolved)) return Err(`\`${value}\` is not a valid number`)
    return Ok(resolved)
  }
  if (resolver === Boolean) {
    switch (value) {
      case 'true':
      case '1':
        return Ok(true)
      case 'false':
      case '0':
        return Ok(false)
      default:
        return Err(`\`${value}\` is not a valid boolean value`)
    }
  }

  try {
    return Ok(resolver(value))
  } catch (error: unknown) {
    return Err(
      error instanceof Error ? error.message : `\`${value}\` is not resolvable`,
    )
  }
}
