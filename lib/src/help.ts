/**
 * @license MIT
 * @file Generated command usage and help.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { create_formatter, type _Formatter } from './renderer'
import { flag_names, is_boolean, merge_params } from './schema'
import type { _Commands, _Flags, App, Argument, Flag } from './types'
import { to_array } from './utils'

function argument_label(key: string, param: Argument): string {
  const name = Array.isArray(param.resolver) ? `${key}...` : key
  const required =
    (param.required ?? true) && !Object.hasOwn(param, 'fallback')
  return required ? `<${name}>` : `[${name}]`
}

function value_label(flag: Flag): string {
  if (is_boolean(flag.resolver)) return ''
  const resolver = Array.isArray(flag.resolver)
    ? flag.resolver[0]
    : flag.resolver
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

function usage_lines(
  fmt: _Formatter,
  base: string,
  cmd: _Commands[string],
  sub: _Commands | undefined,
  flags: _Flags,
): void {
  fmt.line('Usage:')
  fmt.indent()
  const options = Object.keys(flags).length > 0 ? ' [options]' : ''
  const argumentsText = Object.entries(merge_params(cmd).args)
    .map(([key, param]) => argument_label(key, param))
    .join(' ')
  const hasChildren = Object.keys(sub ?? {}).length > 0
  if (cmd.handler || !hasChildren) {
    fmt.line(`${base}${options}${argumentsText ? ` ${argumentsText}` : ''}`)
  }
  if (hasChildren) {
    fmt.line(`${base} <command>${options}`)
  }
  fmt.shift()
}

/**
 * Renders the selected command from its schema, without evaluating values.
 */
export function help_text(
  spec: App,
  cmd: _Commands[string],
  path: readonly string[],
  flags: _Flags,
  name: string,
): string {
  const fmt = create_formatter()
  const params = merge_params(cmd)
  const sub = path.length === 0 ? spec.sub : cmd.sub
  const base = [name, ...path].join(' ')
  const desc = path.length === 0 ? (spec.desc ?? cmd.desc) : cmd.desc
  if (desc) {
    fmt.line(desc)
    fmt.emptyLine()
  }
  usage_lines(fmt, base, cmd, sub, flags)
  section(
    fmt,
    'Commands',
    Object.entries(sub ?? {}).map(([key, child]) => {
      const alias = to_array(child.alias ?? [])
      const label = alias.length > 0 ? `${key} (${alias.join(', ')})` : key
      return [label, child.desc ?? '']
    }),
  )
  section(
    fmt,
    'Arguments',
    Object.entries(params.args).map(([key, param]) => [
      argument_label(key, param),
      parameter_desc(param, true),
    ]),
  )
  section(
    fmt,
    'Options',
    Object.entries(flags).map(([key, flag]) => [
      flag_names(key, flag).join(', ') + value_label(flag),
      parameter_desc(flag, false),
    ]),
  )
  fmt.emptyLine()
  return fmt.raw()
}
