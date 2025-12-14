/**
 * @file Console output colorizing utilities.
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

export interface ChainedStyler extends StylerFunction {
  // Styles
  readonly bold: ChainedStyler
  readonly dim: ChainedStyler
  readonly italic: ChainedStyler
  readonly underline: ChainedStyler
  readonly inverse: ChainedStyler
  readonly hidden: ChainedStyler
  readonly strikethrough: ChainedStyler

  // Foreground Colors
  readonly black: ChainedStyler
  readonly red: ChainedStyler
  readonly green: ChainedStyler
  readonly yellow: ChainedStyler
  readonly blue: ChainedStyler
  readonly magenta: ChainedStyler
  readonly cyan: ChainedStyler
  readonly white: ChainedStyler
  readonly gray: ChainedStyler
  readonly grey: ChainedStyler

  // Background Colors
  readonly bgBlack: ChainedStyler
  readonly bgRed: ChainedStyler
  readonly bgGreen: ChainedStyler
  readonly bgYellow: ChainedStyler
  readonly bgBlue: ChainedStyler
  readonly bgMagenta: ChainedStyler
  readonly bgCyan: ChainedStyler
  readonly bgWhite: ChainedStyler
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
function createStyler(codes: StyleCode[] = []): ChainedStyler {
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

  const stylerFn = templateTag as ChainedStyler

  Object.defineProperty(stylerFn, 'call', { value: apply, enumerable: false })

  for (const name in styleDefinitions) {
    const code = styleDefinitions[name]

    Object.defineProperty(stylerFn, name, {
      get: (): ChainedStyler => {
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
export const black: ChainedStyler = baseColor.black
export const red: ChainedStyler = baseColor.red
export const green: ChainedStyler = baseColor.green
export const yellow: ChainedStyler = baseColor.yellow
export const blue: ChainedStyler = baseColor.blue
export const magenta: ChainedStyler = baseColor.magenta
export const cyan: ChainedStyler = baseColor.cyan
export const white: ChainedStyler = baseColor.white
export const gray: ChainedStyler = baseColor.gray
export const grey: ChainedStyler = baseColor.grey

// Background Colors
export const bgBlack: ChainedStyler = baseColor.bgBlack
export const bgRed: ChainedStyler = baseColor.bgRed
export const bgGreen: ChainedStyler = baseColor.bgGreen
export const bgYellow: ChainedStyler = baseColor.bgYellow
export const bgBlue: ChainedStyler = baseColor.bgBlue
export const bgMagenta: ChainedStyler = baseColor.bgMagenta
export const bgCyan: ChainedStyler = baseColor.bgCyan
export const bgWhite: ChainedStyler = baseColor.bgWhite

// Styles
export const bold: ChainedStyler = baseColor.bold
export const dim: ChainedStyler = baseColor.dim
export const italic: ChainedStyler = baseColor.italic
export const underline: ChainedStyler = baseColor.underline
export const inverse: ChainedStyler = baseColor.inverse
export const hidden: ChainedStyler = baseColor.hidden
export const strikethrough: ChainedStyler = baseColor.strikethrough

// Semantic Aliases
export const success: ChainedStyler = green
export const warning: ChainedStyler = yellow
export const error: ChainedStyler = red
export const info: ChainedStyler = blue
export const debug: ChainedStyler = gray
