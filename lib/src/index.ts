/**
 * @file Public package surface.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

export { run } from './app'
export { app, args, check, cmd, flags, snippet } from './helper'

export type {
  App,
  AppConfig,
  AppTweaks,
  Argument,
  Check,
  CheckContext,
  Command,
  Flag,
  HandlerContext,
  Resolver,
  RunnableApp,
  Snippet,
} from './types'
