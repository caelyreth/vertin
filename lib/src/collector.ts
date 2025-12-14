/**
 * @file Message collector subsystem.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import type { Collector, Message } from './types'
import process from 'node:process'
import { cyan, normal, red, yellow } from './tint'

// MARK: - Internal Types

interface QueuedMessage {
  msg: Message
  logged: boolean
}

// MARK: - Helper Functions

function display(msg: Message) {
  let payload = ''
  switch (msg.level) {
    case 'info':
      payload += cyan`INFO ${normal`${msg.desc}`}`
      break
    case 'warn':
      payload += yellow.bold`WARN ` + yellow`${msg.desc}`
      break
    case 'error':
      payload += red.bold`ERROR ` + red`${msg.desc}`
      break
  }
  payload += '\n'
  process.stderr.write(payload)
}

// MARK: - Collector

/**
 * Creates a new message collector with empty queue.
 */
export function createCollector(): Collector {
  const queue: QueuedMessage[] = []

  return {
    log: (msg) => {
      display(msg)
      queue.push({ msg, logged: true })
    },
    submit: (msg) => {
      queue.push({ msg, logged: false })
    },
    collect: () => {},
  }
}
