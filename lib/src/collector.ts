/**
 * @file Message collector subsystem.
 *
 * The collector centralizes non-throwing diagnostics and terminal output. It is
 * injected into handlers, validators, and other runtime contexts.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import process from 'node:process'

import type { Formatter } from './formatter'
import { createFormatter } from './formatter'
import { blue, cyan, magenta, normal, rawLen, red, yellow } from './tint'
import type { Collector, Diagnostics, Message, Plural } from './types'

// MARK: - Internal Types

interface QueuedMessage {
  readonly msg: Message
  logged: boolean
}

function toArray<T>(value: Plural<T>): T[] {
  return Array.isArray(value) ? value : [value]
}

// MARK: - Display Functions

function displayGroup(heading: string, raw: Plural<string>, fmt: Formatter) {
  fmt.indent()

  if (Array.isArray(raw)) {
    fmt.line(heading)

    fmt.indent()
    for (const item of raw) {
      fmt.line(`- ${item}`)
    }
    fmt.shift()
  } else {
    fmt.line(`${heading}${raw}`)
  }

  fmt.shift()
}

function displayDiagnostics(diag: Diagnostics, fmt: Formatter) {
  fmt.indent()

  const prefix = diag.prefix ?? ''
  let sourceLine = prefix
  let markupLine = ' '.repeat(rawLen(prefix))

  if (Array.isArray(diag.source)) {
    sourceLine += diag.source.join(' ')
    for (const [index, item] of diag.source.entries()) {
      if (index > diag.offset) {
        break
      }

      markupLine +=
        index === diag.offset
          ? '^'.repeat(item.length)
          : ' '.repeat(item.length)

      if (index < diag.source.length - 1 || index === diag.offset) {
        markupLine += ' '
      }
    }
  } else {
    sourceLine += diag.source
    markupLine += ' '.repeat(diag.offset)
    const nextSpace = diag.source.indexOf(' ', diag.offset)
    const endPos = nextSpace === -1 ? diag.source.length : nextSpace
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
      for (const msg of toArray(msgs)) {
        display(msg, brief)
        queue.push({ msg, logged: true })
      }
    },
    submit: (msgs) => {
      for (const msg of toArray(msgs)) {
        queue.push({ msg, logged: false })
      }
    },
    collect: (brief) => {
      for (const entry of queue) {
        if (entry.logged) continue
        display(entry.msg, brief)
        entry.logged = true
      }
    },
  }
}
