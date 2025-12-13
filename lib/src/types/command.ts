import type { _Parsed, Argument, Flag } from './parameter'

export type HandlerContext<
  A extends Record<string, Argument>,
  F extends Record<string, Flag>,
> = _Parsed<A, F> & {
  // TODO: more context features
}

/**
 * Command specification.
 */
export interface Command<
  A extends Record<string, Argument> = Record<string, any>,
  F extends Record<string, Flag> = Record<string, any>,
> {
  /**
   * Brief description of command.
   */
  desc: string

  /**
   * Arguments of the command.
   */
  args?: A

  /**
   * Flags of the command.
   */
  flags?: F

  /**
   * Handler function of the command.
   *
   * @todo complete handler system, currently it's just a placeholder.
   */
  handler: (ctx: HandlerContext<A, F>) => void
}
