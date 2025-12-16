/**
 * @file Built-in error messages.
 *
 * This file contains all reusable built-in error messages across
 * the framework Vertin. All built-in errors are in UPPER_SNAKE_CASE,
 * whatever it is a constant or a function that returns an error message.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import { msg } from './helper'

// MARK: - Matching Stage

export const NO_COMMAND_SPECIFIED = msg({
  level: 'warn',
  desc: 'No command specified; nothing runs',
})

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
