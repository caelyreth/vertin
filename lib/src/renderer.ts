/**
 * @license MIT
 * @file Terminal message rendering. The renderer turns framework messages
 *   and diagnostics into the caret diagrams shown on stderr, backed by the
 *   indentation formatter below. It stays internal to Vertin rendering; the
 *   collector owns queuing, this file owns presentation.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { blue, cyan, magenta, normal, raw_len, red, yellow } from './tint'
import type { _Diagnostics, _Many, _Message } from './types'

// MARK: - formatter

/**
 * Interface for the stateful formatter object returned by create_formatter.
 */
export interface _Formatter {
  /**
   * Adds a line of text to the output, applying the current indentation
   * level.
   */
  line: (raw: string) => void

  /**
   * Increases the current indentation level by one unit.
   */
  indent: () => void

  /**
   * Decreases the current indentation level without going below base level.
   */
  shift: () => void

  /**
   * Adds a blank line (newline character) without any indentation.
   */
  emptyLine: () => void

  /**
   * Retrieves the fully composed and formatted string.
   */
  raw: () => string
}

/**
 * Creates a stateful formatter object using closures to manage indentation
 * and output.
 */
export function create_formatter(indentUnit: string = '  '): _Formatter {
  const output: string[] = []
  let level = 0

  const append = (raw: string): void => {
    if (output.length > 0) output.push('\n')
    output.push(raw)
  }

  const get_prefix = (): string => indentUnit.repeat(level)

  return {
    line: (raw: string) => {
      append(get_prefix() + raw)
    },
    emptyLine: () => {
      append('')
    },
    indent: () => {
      level += 1
    },
    shift: () => {
      level = Math.max(0, level - 1)
    },
    raw: () => output.join(''),
  }
}

// MARK: - markup

type _StringSource = readonly string[]

function is_array_source(source: _Many<string>): source is _StringSource {
  return Array.isArray(source)
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

// MARK: - display

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

/**
 * Renders a single message (and its diagnostics) to stderr.
 */
export function display(msg: _Message, brief: boolean = false): void {
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
