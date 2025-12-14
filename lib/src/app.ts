import type { App } from './types'
import process from 'node:process'
import { createCollector } from './collector'
import { match } from './core'
import { isErr } from './utils'

// MARK: - App Features

export function run(
  spec: App,
  target?: string[],
) {
  // TODO: temporary workaround
  const argv = target ?? process.argv

  const collector = createCollector()

  const matched = match(spec, argv)

  if (isErr(matched)) {
    collector.log(matched.errors)
  }
}
