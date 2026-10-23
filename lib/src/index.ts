/**
 * @license MIT
 * @file Public package surface.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
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
