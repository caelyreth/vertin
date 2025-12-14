/**
 * @file Message collector subsystem.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import type { Collector, Message } from './types'
import process from 'node:process'
import { createFormatter } from './formatter'
import { cyan, normal, red, yellow } from './tint'

// MARK: - Internal Types

interface QueuedMessage {
  msg: Message
  logged: boolean
}

// MARK: - Helper Functions

function display(msg: Message) {
  const fmt = createFormatter()
  switch (msg.level) {
    case 'info':
      fmt.line(cyan`INFO ${normal`${msg.desc}`}`)
      break
    case 'warn':
      fmt.line(yellow.bold`WARN ` + yellow`${msg.desc}`)
      break
    case 'error':
      fmt.line(red.bold`ERROR ` + red`${msg.desc}`)
      break
  }
  process.stderr.write(fmt.raw())
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
