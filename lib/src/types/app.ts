import type { Command } from './command'

/**
 * Vertin framework configuration.
 *
 * @todo complete configuration system, currently it's just a placeholder.
 */
export interface AppConfig {}

/**
 * Application specification.
 */
export interface App {
  /**
   * Brief description of the app.
   */
  desc: string

  /**
   * Version of the app.
   */
  ver?: string

  /**
   * Main command of the app.
   */
  main?: Command

  /**
   * Sub-commands of the app.
   */
  sub?: Record<string, Command>

  /**
   * Vertin framework configuration.
   */
  config?: AppConfig
}
