/**
 * @license MIT
 * @file Application execution pipeline.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { create_collector } from './collector'
import { create_scope } from './core'
import { internal_commands } from './internal'
import { parse } from './parser'
import { create_context } from './runtime'
import { prepare } from './schema'
import type { _Collector, _Message, App } from './types'

function trim_argv(argv: readonly string[]): string[] {
  const trimmedStart = argv
    .slice(0, 2)
    .map((p) => p.replace(/[/\\]+$/, '').replace(/^.*[/\\]/, ''))
  return [...trimmedStart, ...argv.slice(2)]
}

/**
 * Prepares schemas, parses one invocation, validates its values, and
 * executes its handler. Internal and application commands share this
 * pipeline.
 */
export async function run(spec: App): Promise<void> {
  const argv = trim_argv(Bun.argv)
  const collector = create_collector()
  const root = prepare(spec, internal_commands(spec), collector)
  if (collect_errors(collector)) return

  const invocation = parse(root, argv, spec.config)
  collector.submit(invocation.messages)

  const scope = create_scope(
    spec,
    invocation.action.scope(),
    argv[1] ?? '',
    collector,
  )
  const ctx = await create_context(invocation, scope, collector)
  if (collect_errors(collector)) return

  try {
    await invocation.action.command.handler(ctx)
  } catch (reason: unknown) {
    collector.submit(handler_failed(reason))
  }
  collect_errors(collector)
}

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
