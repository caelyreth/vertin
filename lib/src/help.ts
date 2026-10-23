/**
 * @license MIT
 * @file Pure schema-driven help rendering for a command scope.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { create_formatter, type _Formatter } from './renderer'
import { flag_names, is_boolean, resolver_unit } from './schema'
import type { _ContextScope, Argument, Flag } from './types'
import { to_array } from './utils'

function argument_label(key: string, param: Argument): string {
  const name = Array.isArray(param.resolver) ? `${key}...` : key
  const required =
    (param.required ?? true) && !Object.hasOwn(param, 'fallback')
  return required ? `<${name}>` : `[${name}]`
}

function value_label(flag: Flag): string {
  if (is_boolean(flag.resolver)) return ''
  const resolver = resolver_unit(flag.resolver)
  const name =
    resolver === Number
      ? 'number'
      : resolver === String || resolver === undefined
        ? 'string'
        : 'value'
  return ` <${name}${Array.isArray(flag.resolver) ? '...' : ''}>`
}

function parameter_desc(param: Argument | Flag, required: boolean): string {
  const parts = [param.desc ?? '']
  if (param.choices) {
    parts.push(`[choices: ${param.choices.map(String).join(', ')}]`)
  }
  if (Object.hasOwn(param, 'fallback')) {
    parts.push(`[default: ${String(param.fallback)}]`)
  } else if (param.required ?? required) {
    parts.push('[required]')
  }
  return parts.filter(Boolean).join(' ')
}

function section(
  fmt: _Formatter,
  title: string,
  rows: readonly (readonly [string, string])[],
): void {
  if (rows.length === 0) return
  fmt.emptyLine()
  fmt.line(`${title}:`)
  fmt.indent()
  const width = Math.max(...rows.map(([label]) => label.length))
  for (const [label, desc] of rows) {
    fmt.line(desc ? `${label.padEnd(width + 2)}${desc}` : label)
  }
  fmt.shift()
}

function usage_lines(fmt: _Formatter, scope: _ContextScope): void {
  const base = [scope.name, ...scope.path].join(' ')
  const options = Object.keys(scope.flags).length > 0 ? ' [options]' : ''
  const argumentsText = Object.entries(scope.args)
    .map(([key, param]) => argument_label(key, param))
    .join(' ')
  const hasChildren = Object.keys(scope.sub).length > 0
  fmt.line('Usage:')
  fmt.indent()
  if (scope.cmd.handler || !hasChildren) {
    fmt.line(`${base}${options}${argumentsText ? ` ${argumentsText}` : ''}`)
  }
  if (hasChildren) fmt.line(`${base} <command>${options}`)
  fmt.shift()
}

/**
 * Help only consumes scope metadata; it does not parse or dispatch input.
 */
export function help_text(scope: _ContextScope): string {
  const fmt = create_formatter()
  if (scope.cmd.desc) {
    fmt.line(scope.cmd.desc)
    fmt.emptyLine()
  }
  usage_lines(fmt, scope)
  section(
    fmt,
    'Commands',
    Object.entries(scope.sub).map(([key, child]) => {
      const aliases = to_array(child.alias ?? [])
      return [
        aliases.length > 0 ? `${key} (${aliases.join(', ')})` : key,
        child.desc ?? '',
      ]
    }),
  )
  section(
    fmt,
    'Arguments',
    Object.entries(scope.args).map(([key, param]) => [
      argument_label(key, param),
      parameter_desc(param, true),
    ]),
  )
  section(
    fmt,
    'Options',
    Object.entries(scope.flags).map(([key, flag]) => [
      flag_names(key, flag).join(', ') + value_label(flag),
      parameter_desc(flag, false),
    ]),
  )
  fmt.emptyLine()
  return fmt.raw()
}
