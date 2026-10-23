/**
 * @license MIT
 * @file Value resolution and validation for prepared command invocations.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import type { _Invocation, _RawValue } from './parser'
import { is_array_resolver, resolver_unit } from './schema'
import { suggest_hint } from './suggest'
import type {
  _Args,
  _Collector,
  _ContextScope,
  _Flags,
  _Message,
  Argument,
  Flag,
  Resolver,
} from './types'

export interface _RuntimeContext {
  readonly args: Record<string, unknown>
  readonly flags: Record<string, unknown>
  readonly unkArgs: readonly string[]
  readonly unkFlags: readonly string[]
  readonly _: _ContextScope
}

// MARK: - resolution

function error(
  desc: string,
  source: string | readonly string[],
  offset: number,
  markup: string,
): _Message {
  return {
    level: 'error',
    desc,
    diag: {
      source,
      offset,
      markup,
      prefix: Array.isArray(source) ? '> ' : undefined,
    },
  }
}

function resolve_unit(
  raw: string,
  resolver: Resolver | undefined,
): unknown {
  const unit = resolver_unit(resolver)
  if (unit === undefined || unit === String) return raw
  if (unit === Number) {
    const value = Number(raw)
    if (Number.isNaN(value)) {
      throw new Error(`\`${raw}\` is not a valid number`)
    }
    return value
  }
  if (unit === Boolean) {
    if (raw === 'true' || raw === '1') return true
    if (raw === 'false' || raw === '0') return false
    throw new Error(`\`${raw}\` is not a valid boolean value`)
  }
  return unit(raw)
}

function resolve_value(
  raw: readonly _RawValue[],
  resolver: Resolver | undefined,
): unknown {
  if (is_array_resolver(resolver)) {
    if (resolver.length === 0) {
      throw new Error('Array resolver must contain a resolver')
    }
    return raw.map(({ value }) => resolve_unit(value, resolver))
  }
  return resolve_unit(raw[raw.length - 1]!.value, resolver)
}

function resolve_parameter(
  argv: readonly string[],
  key: string,
  spec: Argument | Flag,
  raw: readonly _RawValue[],
  values: Record<string, unknown>,
  collector: _Collector,
  kind: 'argument' | 'flag',
): void {
  try {
    values[key] = resolve_value(raw, spec.resolver)
  } catch (reason: unknown) {
    const message =
      reason instanceof Error
        ? reason.message
        : `\`${kind === 'flag' ? '--' : ''}${key}\` is invalid`
    collector.submit(
      error(`Invalid ${kind} value`, argv, raw[0]!.offset, message),
    )
  }
}

function apply_default(
  key: string,
  spec: Argument | Flag,
  source: string,
  required: boolean,
  desc: string,
  values: Record<string, unknown>,
  collector: _Collector,
): void {
  if (Object.hasOwn(spec, 'fallback')) {
    values[key] = spec.fallback
  } else if (spec.required ?? required) {
    collector.submit(error(desc, source, 0, `\`${source}\` is required`))
  }
}

function parse_arg_values(
  argv: readonly string[],
  specs: _Args,
  raw: readonly _RawValue[],
  unknown: string[],
  collector: _Collector,
): Record<string, unknown> {
  const values: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >
  let offset = 0
  for (const [key, spec] of Object.entries(specs)) {
    const array = is_array_resolver(spec.resolver)
    if (offset >= raw.length) {
      apply_default(
        key,
        spec,
        key,
        true,
        'Missing required argument',
        values,
        collector,
      )
      continue
    }
    const input = array ? raw.slice(offset) : [raw[offset]!]
    offset += input.length
    resolve_parameter(argv, key, spec, input, values, collector, 'argument')
    if (array) break
  }
  for (const value of raw.slice(offset)) {
    unknown.push(value.value)
    collector.submit(
      error(
        'Unknown argument occurred',
        argv,
        value.offset,
        `\`${value.value}\` is not expected here`,
      ),
    )
  }
  return values
}

function parse_flag_values(
  argv: readonly string[],
  specs: _Flags,
  raw: Readonly<Record<string, readonly _RawValue[]>>,
  collector: _Collector,
): Record<string, unknown> {
  const values: Record<string, unknown> = Object.create(null) as Record<
    string,
    unknown
  >
  for (const [key, spec] of Object.entries(specs)) {
    const input = raw[key] ?? []
    if (input.length === 0) {
      apply_default(
        key,
        spec,
        `--${key}`,
        false,
        'Missing required flag',
        values,
        collector,
      )
      continue
    }
    if (!is_array_resolver(spec.resolver) && input.length > 1) {
      collector.submit(
        error(
          'Repeated flag occurred',
          `--${key}`,
          0,
          `\`--${key}\` does not accept multiple values`,
        ),
      )
    }
    resolve_parameter(argv, key, spec, input, values, collector, 'flag')
  }
  return values
}

// MARK: - auditing

function check_choices(
  specs: _Args | _Flags,
  values: Record<string, unknown>,
  collector: _Collector,
): void {
  for (const [key, spec] of Object.entries(specs)) {
    const value = values[key]
    const { choices } = spec
    if (choices === undefined || value === undefined) continue
    const items = is_array_resolver(spec.resolver)
      ? (value as readonly unknown[])
      : [value]
    const invalid = items.filter((item) => !choices.includes(item))
    if (invalid.length === 0) continue
    collector.submit({
      level: 'error',
      desc: 'Invalid parameter choice',
      diag: {
        source: key,
        offset: 0,
        markup: `${invalid.map(String).join(', ')} is not an allowed value`,
        expected: choices.map(String),
        hint: suggest_hint(String(invalid[0]), choices.map(String)),
      },
    })
    delete values[key]
  }
}

function check_markup(key: string, reason: unknown): string {
  if (typeof reason === 'string' && reason.length > 0) return reason
  if (reason instanceof Error && reason.message.length > 0) {
    return reason.message
  }
  if (reason === false || reason === undefined) {
    return `\`${key}\` did not pass its check`
  }
  return reason_text(reason)
}

function reason_text(reason: unknown): string {
  if (typeof reason !== 'object' || reason === null) return String(reason)
  try {
    return JSON.stringify(reason) ?? Object.prototype.toString.call(reason)
  } catch {
    return Object.prototype.toString.call(reason)
  }
}

async function run_checks(
  specs: _Args | _Flags,
  values: Record<string, unknown>,
  collector: _Collector,
): Promise<void> {
  const results = await Promise.all(
    Object.entries(specs).map(async ([key, spec]) => {
      if (spec.check === undefined || values[key] === undefined) {
        return undefined
      }
      try {
        return {
          key,
          result: await spec.check({ value: values[key] as never }),
        }
      } catch (reason: unknown) {
        return { key, result: reason }
      }
    }),
  )
  for (const entry of results) {
    if (
      entry === undefined ||
      entry.result === true ||
      entry.result === undefined
    ) {
      continue
    }
    collector.submit(
      error(
        'Check failed',
        entry.key,
        0,
        check_markup(entry.key, entry.result),
      ),
    )
  }
}

/**
 * Resolves the selected action's own contract. Parsing, mounting and
 * command dispatch have already happened; no particular command is special
 * here.
 */
export async function create_context(
  invocation: _Invocation,
  scope: _ContextScope,
  collector: _Collector,
): Promise<_RuntimeContext> {
  const { argv, parsed, action } = invocation
  const args = parse_arg_values(
    argv,
    action.params.args,
    parsed.args,
    parsed.unkArgs,
    collector,
  )
  const flags = parse_flag_values(
    argv,
    action.params.flags,
    parsed.flags,
    collector,
  )
  check_choices(action.params.args, args, collector)
  check_choices(action.params.flags, flags, collector)
  await run_checks(action.params.args, args, collector)
  await run_checks(action.params.flags, flags, collector)
  return {
    args,
    flags,
    unkArgs: parsed.unkArgs,
    unkFlags: parsed.unkFlags,
    _: scope,
  }
}
