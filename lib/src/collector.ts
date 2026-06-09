/**
 * @file Message collector subsystem.
 *
 * The collector centralizes framework diagnostics and terminal output. It stays
 * internal to Vertin runtime and rendering.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import process from 'node:process'

import type { _Formatter } from './formatter'
import { create_formatter } from './formatter'
import { blue, cyan, magenta, normal, raw_len, red, yellow } from './tint'
import type { _Collector, _Diagnostics, _Many, _Message } from './types'
import { to_array } from './utils'

// MARK: - types

interface _QueuedMessage {
  readonly msg: _Message
  logged: boolean
}

// MARK: - display

function display_group(heading: string, raw: _Many<string>, fmt: _Formatter) {
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

function display_diagnostics(diag: _Diagnostics, fmt: _Formatter) {
  fmt.indent()

  const prefix = diag.prefix ?? ''
  let sourceLine = prefix
  let markupLine = ' '.repeat(raw_len(prefix))

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
    const gap = markupLine.endsWith(' ') ? '' : ' '
    fmt.line(`${markupLine}${gap}${diag.markup}`)
  }

  fmt.shift()

  if (diag.expected) {
    display_group(magenta.bold`Expected `, diag.expected, fmt)
  }

  if (diag.hint) {
    display_group(blue.bold`Hint `, diag.hint, fmt)
  }
}

function display(msg: _Message, brief: boolean = false) {
  const fmt = create_formatter()
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
    display_diagnostics(msg.diag, fmt)
  }

  fmt.emptyLine()
  process.stderr.write(fmt.raw())
}

// MARK: - collector

/** Creates a new message collector with empty queue. */
export function create_collector(): _Collector {
  const queue: _QueuedMessage[] = []

  return {
    log: (msgs, brief) => {
      for (const msg of to_array(msgs)) {
        display(msg, brief)
        queue.push({ msg, logged: true })
      }
    },
    submit: (msgs) => {
      for (const msg of to_array(msgs)) {
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
    has_errors: () => queue.some(({ msg }) => msg.level === 'error'),
  }
}
