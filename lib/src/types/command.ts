import type { Argument, Flag } from './parameter'

/**
 * Command specification.
 */
export interface Command {
  /**
   * Brief description of command.
   */
  desc: string

  /**
   * Arguments of the command.
   */
  args?: Record<string, Argument>

  /**
   * Flags of the command.
   */
  flags?: Record<string, Flag>

  /**
   * Handler function of the command.
   *
   * @todo complete handler system, currently it's just a placeholder.
   */
  handler: () => void
}
