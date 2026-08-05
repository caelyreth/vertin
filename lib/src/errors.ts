/**
 * @file Built-in error messages.
 *
 * This file contains all reusable built-in error messages across
 * the framework Vertin. Built-in errors use snake_case names whether they are
 * constants or functions returning an error message.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import type { _Message } from './types'

// MARK: - matching stage

export const no_command_specified = {
  level: 'warn',
  desc: 'No command specified; nothing runs',
} satisfies _Message

/**
 * Creates a diagnostic for an unknown command token.
 */
export function invalid_command(
  source: readonly string[],
  offset: number,
  token: string,
) {
  return {
    level: 'error',
    desc: 'Invalid command occurred',
    diag: {
      source,
      offset,
      markup: `\`${token}\` is not a valid command`,
      prefix: '> ',
    },
  } satisfies _Message
}
