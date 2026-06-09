/**
 * @file Public package surface.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

export { run } from './app'
export { app, args, check, cmd, flags, msg, snippet } from './helper'

export type {
  App,
  AppConfig,
  Argument,
  Check,
  CheckContext,
  Collector,
  Command,
  Diagnostics,
  Flag,
  HandlerContext,
  Message,
  Resolver,
  RunnableApp,
  Severity,
  Snippet,
} from './types'
