/**
 * @file Runtime entry point for Vertin applications.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import path from 'node:path'
import process from 'node:process'

import { createCollector } from './collector'
import { match } from './core'
import type { App } from './types'
import { isErr } from './utils'

// MARK: - Utilities

function trimArgv(argv: readonly string[]): string[] {
  const trimmedStart = argv.slice(0, 2).map((p) => path.basename(p))
  const remainingArgs = argv.slice(2)
  return [...trimmedStart, ...remainingArgs]
}

// MARK: - Run An App

/** Runs a Vertin application against the current process arguments. */
export function run(spec: App): void {
  const argv = trimArgv(process.argv)
  const collector = createCollector()
  const matched = match(spec, argv, 2)

  if (isErr(matched)) {
    collector.log(matched.errors)
    process.exitCode = 1
  }
}
