/**
 * @file Runtime entry point for Vertin applications.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import path from 'node:path'
import process from 'node:process'

import { create_collector } from './collector'
import { match } from './core'
import { create_context } from './runtime'
import type { App, Message } from './types'
import { is_err } from './utils'

// MARK: - Utilities

function trim_argv(argv: readonly string[]): string[] {
  const trimmedStart = argv.slice(0, 2).map((p) => path.basename(p))
  const remainingArgs = argv.slice(2)
  return [...trimmedStart, ...remainingArgs]
}

// MARK: - Run An App

function handler_failed(reason: unknown): Message {
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

/** Runs a Vertin application against the current process arguments. */
export async function run(spec: App): Promise<void> {
  const argv = trim_argv(process.argv)
  const collector = create_collector()
  const matched = match(spec, argv, 2)

  if (is_err(matched)) {
    collector.log(matched.errors)
    process.exitCode = 1
    return
  }

  const [cmd, offset] = matched.value
  const ctx = await create_context(spec, cmd, argv, offset, collector)

  collector.collect()
  if (collector.has_errors()) {
    process.exitCode = 1
    return
  }

  try {
    await cmd.handler(ctx)
  } catch (reason: unknown) {
    collector.log(handler_failed(reason))
    process.exitCode = 1
    return
  }

  collector.collect()
  if (collector.has_errors()) {
    process.exitCode = 1
  }
}
