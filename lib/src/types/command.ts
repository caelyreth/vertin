import type { _Parsed, ArgumentRecord, FlagRecord } from './parameter'

export type HandlerContext<
  A extends ArgumentRecord,
  F extends FlagRecord,
> = _Parsed<A, F> & {
  // TODO: more context features
}

/**
 * Command specification.
 */
export interface Command<
  A extends ArgumentRecord = ArgumentRecord,
  F extends FlagRecord = FlagRecord,
> {
  /**
   * Brief description of command.
   */
  desc?: string

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
