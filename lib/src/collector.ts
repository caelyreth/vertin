/**
 * @license MIT
 * @file Message collector subsystem. The collector centralizes framework
 *   diagnostics and terminal output. It stays internal to Vertin runtime
 *   and rendering.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { display } from './renderer'
import type { _Collector, _Message } from './types'
import { to_array } from './utils'

// MARK: - types

interface _QueuedMessage {
  readonly msg: _Message
  logged: boolean
}

// MARK: - collector

/**
 * Creates a new message collector with empty queue.
 */
export function create_collector(): _Collector {
  const queue: _QueuedMessage[] = []
  let hasErrors = false

  const push = (msg: _Message, logged: boolean) => {
    if (msg.level === 'error') hasErrors = true
    queue.push({ msg, logged })
  }

  return {
    log: (msgs, brief) => {
      for (const msg of to_array(msgs)) {
        display(msg, brief)
        push(msg, true)
      }
    },
    submit: (msgs) => {
      for (const msg of to_array(msgs)) {
        push(msg, false)
      }
    },
    collect: (brief) => {
      for (const entry of queue) {
        if (entry.logged) continue
        display(entry.msg, brief)
        entry.logged = true
      }
    },
    has_errors: () => hasErrors,
  }
}
