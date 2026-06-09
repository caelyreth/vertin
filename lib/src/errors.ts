/**
 * @file Built-in error messages.
 *
 * This file contains all reusable built-in error messages across
 * the framework Vertin. All built-in errors are in UPPER_SNAKE_CASE,
 * whatever it is a constant or a function that returns an error message.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import { msg } from './helper'

// MARK: - Matching Stage

export const NO_COMMAND_SPECIFIED = msg({
  level: 'warn',
  desc: 'No command specified; nothing runs',
})

/** Creates a diagnostic for an unknown command token. */
export function INVALID_COMMAND(
  source: string[],
  offset: number,
  token: string,
) {
  return msg({
    level: 'error',
    desc: 'Invalid command occurred',
    diag: {
      source,
      offset,
      markup: `\`${token}\` is not a valid command`,
      prefix: '> ',
    },
  })
}
