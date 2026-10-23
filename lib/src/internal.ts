/**
 * @license MIT
 * @file Internal commands mounted into prepared application scopes.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { help_text } from './help'
import type { _ExecutableCommand, _InternalCommand } from './schema'
import type { App, HandlerContext } from './types'
import { is_err } from './utils'

type _HelpArgs = {
  command: { resolver: [StringConstructor]; required: false }
}

function show_help(ctx: HandlerContext<_HelpArgs, {}, []>): void {
  const scope = ctx._.resolve(ctx.args.command ?? [])
  if (is_err(scope)) {
    ctx._.collector.submit(scope.errors)
    return
  }
  process.stdout.write(help_text(scope.value))
}

const help_command: _ExecutableCommand = {
  desc: 'Show help for a command',
  args: { command: { resolver: [String], required: false } },
  handler: show_help,
}

function show_version(ctx: HandlerContext<{}, {}, []>): void {
  process.stdout.write(`${ctx._.app.ver}\n`)
}

const version_command: _ExecutableCommand = {
  desc: 'Show version',
  handler: show_version,
}

/**
 * Internal commands use the same execution contract as application
 * commands. The first definition is also the default action for handlerless
 * groups.
 */
export function internal_commands(
  spec: App,
): readonly [_InternalCommand, ..._InternalCommand[]] {
  const help = spec.config?.help !== false
  const commands: [_InternalCommand, ..._InternalCommand[]] = [
    {
      name: 'help',
      command: help_command,
      mount: help,
      option: help
        ? { alias: 'h', resolver: Boolean, desc: 'Show help' }
        : undefined,
    },
  ]
  if (spec.ver !== undefined && spec.config?.version !== false) {
    commands.push({
      name: 'version',
      command: version_command,
      mount: false,
      option: { alias: 'V', resolver: Boolean, desc: 'Show version' },
    })
  }
  return commands
}
