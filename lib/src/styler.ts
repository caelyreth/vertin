/**
 * @file Vertin console output colorizing utilities.
 *
 * This file contains the self-contained types and functions
 * for applying ANSI color codes to console output strings.
 *
 * NOTE: This module create style definitions in runtime,
 * only runs once when the module first import.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

// MARK: - Basic Types
interface StyleCode {
  open: number
  close: number
}

interface StylerFunction {
  (raw: string): string
  (strings: TemplateStringsArray, ...values: any[]): string
}

export interface Styler extends StylerFunction {
  // Styles
  readonly bold: Styler
  readonly dim: Styler
  readonly italic: Styler
  readonly underline: Styler
  readonly inverse: Styler
  readonly hidden: Styler
  readonly strikethrough: Styler
  readonly reset: Styler

  // Foreground Colors
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

  // Background Colors
  readonly bgBlack: Styler
  readonly bgRed: Styler
  readonly bgGreen: Styler
  readonly bgYellow: Styler
  readonly bgBlue: Styler
  readonly bgMagenta: Styler
  readonly bgCyan: Styler
  readonly bgWhite: Styler
}

// MARK: - Constants
const ESC = '\x1B['
const RESET = `${ESC}0m`

const FG: Readonly<Record<string, number>> = {
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

const BG: Readonly<Record<string, number>> = {
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

const STYLE: Readonly<Record<string, [number, number]>> = {
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  inverse: [7, 27],
  hidden: [8, 28],
  strikethrough: [9, 29],
  reset: [0, 0],
} as const

// MARK: - Once Effects
const styleDefinitions: Record<string, StyleCode> = {}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const ESCAPED_RESET = escapeRegex(RESET)

const RESET_REGEX = new RegExp(ESCAPED_RESET, 'g')

function registerStyle(name: string, open: number, close: number = 0) {
  styleDefinitions[name] = { open, close }
}

for (const [name, open] of Object.entries(FG)) {
  registerStyle(name, open)
}

for (const [name, open] of Object.entries(BG)) {
  const bgName = `bg${name.charAt(0).toUpperCase()}${name.slice(1)}`
  registerStyle(bgName, open)
}

for (const [name, [open, close]] of Object.entries(STYLE)) {
  registerStyle(name, open, close)
}

// MARK: - Factory
function createStyler(codes: StyleCode[] = []): Styler {
  const openSeq = codes.map(c => `${ESC}${c.open}m`).join('')
  const closeSeq = codes.slice().reverse().map(c => `${ESC}${c.close}m`).join('')

  const apply = (text: string): string => {
    if (!text) {
      return text
    }

    const replaced = text.replace(RESET_REGEX, `${closeSeq}${openSeq}`)
    return `${openSeq}${replaced}${closeSeq}`
  }

  const templateTag = (strings: TemplateStringsArray, ...values: any[]): string => {
    let rawText = strings[0]
    for (let i = 0; i < values.length; i++) {
      const value = typeof values[i] === 'function' ? values[i]('') : String(values[i])
      rawText += value + strings[i + 1]
    }
    return apply(rawText)
  }

  const stylerFn = templateTag as Styler

  Object.defineProperty(stylerFn, 'call', { value: apply, enumerable: false })

  for (const name in styleDefinitions) {
    const code = styleDefinitions[name]

    Object.defineProperty(stylerFn, name, {
      get: (): Styler => {
        const newCodes = [...codes, code]
        return createStyler(newCodes)
      },
      enumerable: true,
      configurable: false,
    })
  }

  return stylerFn
}

// MARK: - Public Exports
const baseColor = createStyler()

// Foreground Colors
export const black: Styler = baseColor.black
export const red: Styler = baseColor.red
export const green: Styler = baseColor.green
export const yellow: Styler = baseColor.yellow
export const blue: Styler = baseColor.blue
export const magenta: Styler = baseColor.magenta
export const cyan: Styler = baseColor.cyan
export const white: Styler = baseColor.white
export const grey: Styler = baseColor.grey
export const normal: Styler = baseColor.normal

// Background Colors
export const bgBlack: Styler = baseColor.bgBlack
export const bgRed: Styler = baseColor.bgRed
export const bgGreen: Styler = baseColor.bgGreen
export const bgYellow: Styler = baseColor.bgYellow
export const bgBlue: Styler = baseColor.bgBlue
export const bgMagenta: Styler = baseColor.bgMagenta
export const bgCyan: Styler = baseColor.bgCyan
export const bgWhite: Styler = baseColor.bgWhite

// Styles
export const bold: Styler = baseColor.bold
export const dim: Styler = baseColor.dim
export const italic: Styler = baseColor.italic
export const underline: Styler = baseColor.underline
export const inverse: Styler = baseColor.inverse
export const hidden: Styler = baseColor.hidden
export const strikethrough: Styler = baseColor.strikethrough
export const reset: Styler = baseColor.reset

// Semantic Aliases
export const success: Styler = green
export const warning: Styler = yellow
export const error: Styler = red
export const info: Styler = blue
export const debug: Styler = grey
