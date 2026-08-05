/**
 * @file Terminal output colorization utilities for Vertin.
 *
 * This module is copied from '@uttr/tint', a lightweight utility for
 * applying ANSI color codes to console output.
 *
 * Note: '@uttr/tint' is a trusted internal dependency developed by the
 * same author. Repository: https://github.com/utakotoba/uttr-tint
 *
 * To maintain a zero-dependency footprint, this library is bundled
 * directly with Vertin.
 *
 * @copyright Yu 2026
 * @author Yu <me@iki.moe>
 * @license MIT (Inherited from @uttr/tint)
 */

import process from 'node:process'

// MARK: - constants
const ESC = '\x1B['

const FG = {
  black: 30,
  red: 31,
  green: 32,
  yellow: 33,
  blue: 34,
  magenta: 35,
  cyan: 36,
  white: 37,
  grey: 90,
  normal: 39,
} as const

const BG = {
  black: 40,
  red: 41,
  green: 42,
  yellow: 43,
  blue: 44,
  magenta: 45,
  cyan: 46,
  white: 47,
  grey: 100,
} as const

const STYLE = {
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],
  reset: [0, 0],
} as const

// MARK: - types

/**
 * Styler is used to style text with ANSI escape codes.
 */
export interface Styler {
  (text: string): string
  (strings: TemplateStringsArray, ...values: unknown[]): string

  // Foreground
  readonly black: Styler
  readonly red: Styler
  readonly green: Styler
  readonly yellow: Styler
  readonly blue: Styler
  readonly magenta: Styler
  readonly cyan: Styler
  readonly white: Styler
  readonly grey: Styler
  readonly normal: Styler

  // Background
  readonly bgBlack: Styler
  readonly bgRed: Styler
  readonly bgGreen: Styler
  readonly bgYellow: Styler
  readonly bgBlue: Styler
  readonly bgMagenta: Styler
  readonly bgCyan: Styler
  readonly bgWhite: Styler

  // Styles
  readonly bold: Styler
  readonly dim: Styler
  readonly italic: Styler
  readonly underline: Styler
  readonly inverse: Styler
  readonly hidden: Styler
  readonly strikethrough: Styler
  readonly reset: Styler
}

/**
 * Internal styler state carried by chained style functions.
 */
interface _Styler extends Styler {
  _open: string
  _close: string
  _replacements: Record<string, string>
}

// MARK: - env detection

function is_color_supported(): boolean {
  const { env, stdout } = process
  if (env.NO_COLOR || env.NODE_DISABLE_COLORS) return false
  if (env.FORCE_COLOR) return true
  return stdout.isTTY === true
}

const ENABLED = is_color_supported()

// MARK: - once setup

const styles: Record<string, { open: string; close: string }> = {}

function add(name: string, open: number, close: number) {
  styles[name] = {
    open: `${ESC}${open}m`,
    close: `${ESC}${close}m`,
  }
}

for (const [name, code] of Object.entries(FG)) {
  add(name, code, 39)
}

for (const [name, code] of Object.entries(BG)) {
  add(`bg${name.charAt(0).toUpperCase()}${name.slice(1)}`, code, 49)
}

for (const [name, [open, close]] of Object.entries(STYLE)) {
  add(name, open, close)
}

// MARK: - styler

const proto = {}

const escape_regex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function is_template_strings_array(
  value: string | TemplateStringsArray,
): value is TemplateStringsArray {
  return Array.isArray(value) && 'raw' in value
}

// factory
function create_styler(
  open: string,
  close: string,
  regex: RegExp | null,
  replacements: Record<string, string>,
): Styler {
  const fn = function (
    strings: TemplateStringsArray | string,
    ...values: unknown[]
  ) {
    let text: string
    if (typeof strings === 'string' && values.length === 0) {
      text = strings
    } else if (is_template_strings_array(strings)) {
      const [first] = strings
      text = first
      const len = values.length
      for (let i = 0; i < len; i += 1) {
        text += String(values[i]) + strings[i + 1]
      }
    } else {
      text = String(strings)
    }

    if (!ENABLED) {
      return text
    }

    if (regex) {
      text = text.replace(regex, (match) => replacements[match] ?? match)
    }

    return `${open}${text}${close}`
  } as _Styler

  fn._open = open
  fn._close = close
  fn._replacements = replacements

  Object.setPrototypeOf(fn, proto)
  return fn
}

const base = create_styler('', '', null, {})

for (const [name, { open, close }] of Object.entries(styles)) {
  Object.defineProperty(proto, name, {
    get() {
      const parent = this as _Styler
      const parentOpen = parent._open
      const parentClose = parent._close
      const parentReplacements = parent._replacements

      const newOpen = parentOpen + open
      const newClose = close + parentClose

      const newReplacements = { ...parentReplacements }

      const resetKey = `${ESC}0m`
      const existingReset = newReplacements[resetKey] ?? resetKey
      newReplacements[resetKey] = existingReset + open

      const closeKey = close
      const existingClose = newReplacements[closeKey] ?? closeKey
      newReplacements[closeKey] = existingClose + open

      const keys = Object.keys(newReplacements).map(escape_regex)
      const regex = new RegExp(keys.join('|'), 'g')

      const next = create_styler(newOpen, newClose, regex, newReplacements)

      Object.defineProperty(this, name, {
        value: next,
        enumerable: true,
        configurable: false,
      })

      return next
    },
    enumerable: true,
    configurable: false,
  })
}

// MARK: - utils

// eslint-disable-next-line no-control-regex
const RE_ANSI = /\x1B\[\d+m/g

/**
 * Strip ANSI escape codes from a string
 *
 * @param str - The string to strip ANSI escape codes from
 *
 * @returns The string with ANSI escape codes removed
 */
export function strip(str: string): string {
  return str.replace(RE_ANSI, '')
}

/**
 * Get the raw length of a string, ignoring ANSI escape codes
 *
 * @param str - The string to get the raw length of
 *
 * @returns The raw length of the string
 */
export function raw_len(str: string): number {
  return strip(str).length
}

// MARK: - exports

export const black: Styler = base.black
export const red: Styler = base.red
export const green: Styler = base.green
export const yellow: Styler = base.yellow
export const blue: Styler = base.blue
export const magenta: Styler = base.magenta
export const cyan: Styler = base.cyan
export const white: Styler = base.white
export const grey: Styler = base.grey
export const normal: Styler = base.normal

export const bgBlack: Styler = base.bgBlack
export const bgRed: Styler = base.bgRed
export const bgGreen: Styler = base.bgGreen
export const bgYellow: Styler = base.bgYellow
export const bgBlue: Styler = base.bgBlue
export const bgMagenta: Styler = base.bgMagenta
export const bgCyan: Styler = base.bgCyan
export const bgWhite: Styler = base.bgWhite

export const bold: Styler = base.bold
export const dim: Styler = base.dim
export const italic: Styler = base.italic
export const underline: Styler = base.underline
export const inverse: Styler = base.inverse
export const hidden: Styler = base.hidden
export const strikethrough: Styler = base.strikethrough
export const reset: Styler = base.reset
