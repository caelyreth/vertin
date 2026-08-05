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

type _StringSource = readonly string[]

function is_array_source(source: _Many<string>): source is _StringSource {
  return Array.isArray(source)
}

function display_group(
  heading: string,
  raw: _Many<string>,
  fmt: _Formatter,
) {
  fmt.indent()

  if (is_array_source(raw)) {
    fmt.line(heading)

    fmt.indent()
    for (const item of raw) {
      fmt.line(`- ${item}`)
    }
    fmt.shift()
  } else {
    fmt.line(heading + raw)
  }

  fmt.shift()
}

function markup_len(source: string, offset: number): number {
  const nextSpace = source.indexOf(' ', offset)
  return (nextSpace === -1 ? source.length : nextSpace) - offset
}

function build_string_markup(source: string, offset: number): string {
  return ' '.repeat(offset) + '^'.repeat(markup_len(source, offset))
}

function build_array_markup(source: _StringSource, offset: number): string {
  let markup = ''
  const { length } = source

  for (const [index, item] of source.entries()) {
    if (index > offset) break

    markup +=
      index === offset ? '^'.repeat(item.length) : ' '.repeat(item.length)

    if (index < length - 1 || index === offset) {
      markup += ' '
    }
  }

  return markup
}

function display_diagnostics(diag: _Diagnostics, fmt: _Formatter) {
  fmt.indent()

  const prefix = diag.prefix ?? ''
  const isArray = is_array_source(diag.source)
  const sourceText = isArray ? diag.source.join(' ') : diag.source
  const markup = isArray
    ? build_array_markup(diag.source, diag.offset)
    : build_string_markup(diag.source, diag.offset)
  const markupLine = ' '.repeat(raw_len(prefix)) + markup

  fmt.line(prefix + sourceText)
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
