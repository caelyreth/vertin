/**
 * @file Message collector subsystem.
 *
 * Collector is a main concept in the Vertin framework; it is mainly
 * Responsible for the non-throwable error handling inside the framework.
 * It is also responsible for the message formatting and display.
 *
 * These APIs could be used in many parts of the framework by developers.
 * It will be injected into the handler context, constraint context, etc.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

import process from 'node:process'

import type { Formatter } from './formatter'
import { createFormatter } from './formatter'
import { blue, cyan, magenta, normal, red, yellow } from './tint'
import type { Collector, Diagnostics, Message } from './types'

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
  } else {
    heading += raw
    fmt.line(heading)
  }

  fmt.shift()
}

function displayDiagnostics(diag: Diagnostics, fmt: Formatter) {
  fmt.indent()

  let sourceLine = ''
  let markupLine = ''

  if (Array.isArray(diag.source)) {
    sourceLine += diag.source.join(' ')
    for (let i = 0; i < diag.source.length; i++) {
      const elem = diag.source[i]
      if (i === diag.offset) {
        markupLine += '^'.repeat(elem.length)
      } else if (i <= diag.offset) {
        markupLine += ' '.repeat(elem.length)
      } else {
        break
      }
      if (i < diag.source.length - 1 || i === diag.offset) {
        markupLine += ' '
      }
    }
  } else {
    sourceLine += diag.source
    markupLine += ' '.repeat(diag.offset)
    let endPos = diag.offset
    while (endPos < diag.source.length && diag.source[endPos] !== ' ') {
      endPos++
    }
    markupLine += '^'.repeat(endPos - diag.offset)
  }

  fmt.line(sourceLine)
  if (markupLine !== '') {
    markupLine += diag.markup
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

/** Creates a new message collector with empty queue. */
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
