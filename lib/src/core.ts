/**
 * @file Command matching and parameter parsing subsystem.
 *
 * This file contains all core functions across the framework
 * to resolve user input into its corresponding context.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import type { App, Command, CtorResolver, FnResolver, Message, Result } from './types'
import { INVALID_COMMAND, NO_COMMAND_SPECIFIED } from './errors'
import { Err, Ok } from './utils'

// MARK: - Constants &  Utilities

const SINGLE_DASH = '-'

function isFlag(str: string) {
  return str.startsWith(SINGLE_DASH)
}

// MARK: - Command Matching

export function match(
  spec: App,
  argv: readonly string[],
  offset: number = 2,
): Result<[Command, number], Message> {
  // TODO: support to help and completion commands
  let token = argv[offset]

  if (token && isFlag(token)) {
    if (spec.main) {
      return Ok([spec.main, offset])
    }
    return Err(NO_COMMAND_SPECIFIED)
  }

  if (token && spec.sub && token in spec.sub) {
    let cmd = spec.sub[token]
    offset += 1

    while (true) {
      token = argv[offset]
      if (token && cmd.sub && token in cmd.sub) {
        cmd = cmd.sub[token]
        offset += 1
      }
      else {
        return Ok([cmd, offset])
      }
    }
  }

  if (spec.main) {
    return Ok([spec.main, offset])
  }

  if (token) {
    return Err(INVALID_COMMAND([...argv], offset, token))
  }

  return Err(NO_COMMAND_SPECIFIED)
}

// MARK: - Value Resolution

// Resolve a raw value with given non-array resolver
// Success: resolved value; Error: markup string
function _resolve(
  value: string,
  r: FnResolver | CtorResolver = String,
): Result<any, string> {
  if (r === String)
    return Ok(value)
  if (r === Number) {
    const resolved = Number(value)
    if (Number.isNaN(resolved))
      return Err(`\`${value}\` is not a valid number`)
    return Ok(resolved)
  }
  if (r === Boolean) {
    if (value === 'true' || value === '1')
      return Ok(true)
    if (value === 'false' || value === '0')
      return Ok(false)
    return Err(`\`${value}\` is not a valid boolean value`)
  }
  if (typeof r === 'function') {
    try {
      const resolved = (r as FnResolver)(value)
      return Ok(resolved)
    }
    catch (e: any) {
      if (e instanceof Error) {
        return Err(e.message)
      }
      else {
        return Err(`\`${value}\` is not resolvable`)
      }
    }
  }
  return Err('Field is configured with a invalid resolver')
}
