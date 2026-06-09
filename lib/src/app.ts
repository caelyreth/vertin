import path from 'node:path'
import process from 'node:process'

import { createCollector } from './collector'
import { match } from './core'
import type { App } from './types'
import { isErr } from './utils'

// MARK: - Utilities

function trimArgv(argv: string[]) {
  const trimmedStart = argv.slice(0, 2).map((p) => path.basename(p))
  const remainingArgs = argv.slice(2)
  return [...trimmedStart, ...remainingArgs]
}

// MARK: - Run An App

export function run(spec: App) {
  const argv = trimArgv(process.argv)

  const collector = createCollector()

  const matched = match(spec, argv, 2)

  if (isErr(matched)) {
    collector.log(matched.errors)
    process.exit(1) // TODO: temporary workaround
  }
}
