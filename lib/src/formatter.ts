/**
 * @file Console format output utilities.
 *
 * @copyright Kohane 2025
 * @author Kohane <i@kept.to>
 * @license MPL-2.0
 */

/**
 * Interface for the stateful Formatter object returned by createFormatter.
 */
interface Formatter {
  /**
   * Adds a line of text to the output, applying the current indentation level.
   */
  line: (raw: string) => void

  /**
   * Increases the current indentation level by one unit.
   */
  indent: () => void

  /**
   * Decreases the current indentation level by one unit. Throws if already at base level.
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
 * Creates a stateful formatter object using closures to manage indentation and output.
 */
export function createFormatter(indentUnit: string = '  '): Formatter {
  const output: string[] = []
  let level = 0

  const getPrefix = (): string => {
    return indentUnit.repeat(level)
  }

  return {
    line: (raw: string) => {
      const indentedLine = getPrefix() + raw
      if (output.length > 0) {
        output.push('\n')
      }
      output.push(indentedLine)
    },
    emptyLine: () => {
      if (output.length > 0) {
        output.push('\n')
      }
      output.push('')
    },
    indent: () => {
      level += 1
    },
    shift: () => {
      if (level <= 0) {
        level = 0
      }
      level -= 1
    },
    raw: () => {
      return output.join('')
    },
  }
}
