/**
 * @file Message collector subsystem.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import type { Formatter } from './formatter'
import type { Collector, Diagnostics, Message } from './types'
import process from 'node:process'
import { createFormatter } from './formatter'
import { blue, cyan, magenta, normal, red, yellow } from './tint'

// MARK: - Internal Types

interface QueuedMessage {
  msg: Message
  logged: boolean
}

// MARK: - Display Functions

function displayGroup(heading: string, raw: string | string[], fmt: Formatter) {
  fmt.indent()

  if (Array.isArray(raw)) {
    fmt.line(heading)

    fmt.indent()
    for (const el of raw) {
      fmt.line(`- ${el}`)
    }
    fmt.shift()
  }
  else {
    heading += raw
    fmt.line(heading)
  }

  fmt.shift()
}

function displayDiagnostics(diag: Diagnostics, fmt: Formatter) {
  fmt.indent()

  let sourceLine: string
  let markupLine = ''

  if (Array.isArray(diag.source)) {
    sourceLine = diag.source.join(' ')
    for (let i = 0; i < diag.source.length; i++) {
      const elem = diag.source[i]
      if (i === diag.offset) {
        markupLine += '^'.repeat(elem.length)
      }
      else if (i <= diag.offset) {
        markupLine += ' '.repeat(elem.length)
      }
      else {
        break
      }
      if (i < diag.source.length - 1) {
        markupLine += ' '
      }
    }
  }
  else {
    sourceLine = diag.source
    markupLine += ' '.repeat(diag.offset)
    let endPos = diag.offset
    while (endPos < diag.source.length && diag.source[endPos] !== ' ') {
      endPos++
    }
    markupLine += '^'.repeat(endPos - diag.offset)
  }

  fmt.line(sourceLine)
  if (markupLine !== '') {
    markupLine += ` ${diag.markup}`
    fmt.line(markupLine)
  }

  fmt.shift()

  if (diag.expected) {
    displayGroup(magenta.bold`Expected `, diag.expected, fmt)
  }

  if (diag.hint) {
    displayGroup(blue.bold`Hint `, diag.hint, fmt)
  }
}

function display(msg: Message, brief: boolean = false) {
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

  if (msg.diag && !brief) {
    displayDiagnostics(msg.diag, fmt)
  }

  fmt.emptyLine()
  process.stderr.write(fmt.raw())
}

// MARK: - Collector

/**
 * Creates a new message collector with empty queue.
 */
export function createCollector(): Collector {
  const queue: QueuedMessage[] = []

  return {
    log: (msgs, brief) => {
      const resolved = Array.isArray(msgs) ? msgs : [msgs]
      for (const m of resolved) {
        display(m, brief)
        queue.push({ msg: m, logged: true })
      }
    },
    submit: (msgs) => {
      const resolved = Array.isArray(msgs) ? msgs : [msgs]
      for (const m of resolved) {
        queue.push({ msg: m, logged: false })
      }
    },
    collect: () => {},
  }
}
