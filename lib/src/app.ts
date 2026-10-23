/**
 * @license MIT
 * @file Runtime entry point for Vertin applications.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { create_collector } from './collector'
import { match } from './core'
import { help_text } from './help'
import { create_context, flag_tokens } from './runtime'
import type { _Collector, _Message, App } from './types'
import { is_err } from './utils'

// MARK: - utils

function trim_argv(argv: readonly string[]): string[] {
  const trimmedStart = argv
    .slice(0, 2)
    .map((p) => p.replace(/[/\\]+$/, '').replace(/^.*[/\\]/, ''))
  const remainingArgs = argv.slice(2)
  return [...trimmedStart, ...remainingArgs]
}

// MARK: - app runner

/**
 * Runs a Vertin application against the current process arguments.
 */
export async function run(spec: App): Promise<void> {
  const argv = trim_argv(Bun.argv)
  const name = argv[1] ?? ''
  const collector = create_collector()
  const matched = match(spec, argv, 2)

  if (is_err(matched)) {
    collector.log(matched.errors)
    process.exitCode = 1
    return
  }

  const { cmd, flags, commands } = matched.value
  flag_tokens(flags, collector)
  if (collect_errors(collector)) return

  const ctx = await create_context(spec, cmd, argv, 2, collector, {
    flags,
    commands,
    help: cmd.handler === undefined,
    builtin: matched.value.help ? 'help' : undefined,
  })

  if (ctx.builtin) {
    process.stdout.write(
      ctx.builtin === 'version'
        ? `${spec.ver}\n`
        : help_text(spec, cmd, matched.value.path, flags, name),
    )
    return
  }
  if (collect_errors(collector)) return

  if (!cmd.handler) {
    process.stdout.write(
      help_text(spec, cmd, matched.value.path, flags, name),
    )
    return
  }

  try {
    await cmd.handler(ctx)
  } catch (reason: unknown) {
    collector.log(handler_failed(reason))
    process.exitCode = 1
    return
  }
}

// MARK: - helpers

function collect_errors(collector: _Collector): boolean {
  collector.collect()
  if (!collector.has_errors()) return false
  process.exitCode = 1
  return true
}

function handler_failed(reason: unknown): _Message {
  return {
    level: 'error',
    desc: 'Handler failed',
    diag: {
      source: reason instanceof Error ? reason.message : String(reason),
      offset: 0,
      markup: 'handler failed during execution',
    },
  }
}
