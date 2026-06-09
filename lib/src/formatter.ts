/**
 * @file Console format output utilities.
 *
 * Formatter is a utility in the Vertin framework; it can be used to
 * create formats like indentation, etc., easily.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

/** Interface for the stateful formatter object returned by create_formatter. */
export interface _Formatter {
  /** Adds a line of text to the output, applying the current indentation level. */
  line: (raw: string) => void

  /** Increases the current indentation level by one unit. */
  indent: () => void

  /** Decreases the current indentation level without going below base level. */
  shift: () => void

  /** Adds a blank line (newline character) without any indentation. */
  emptyLine: () => void

  /** Retrieves the fully composed and formatted string. */
  raw: () => string
}

/**
 * Creates a stateful formatter object using closures to manage indentation and
 * output.
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
