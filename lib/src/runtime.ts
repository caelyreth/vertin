/**
 * @file Runtime parsing and context construction.
 *
 * @copyright Yu 2026
 * @author Yu <i@voidknot.com>
 * @license MIT
 */

import type {
  _Args,
  _Commands,
  _Flags,
  _Collector,
  _Message,
  _ResolverCtor,
  _ResolverFn,
  App,
  AppConfig,
  Argument,
  Flag,
  HandlerContext,
  Resolver,
  Snippet,
} from './types'
import { to_array } from './utils'

// MARK: - types

interface _RawValue {
  readonly value: string
  readonly offset: number
  readonly token: string
}

interface _Params {
  readonly args: _Args
  readonly flags: _Flags
}

interface _ParsedArgv {
  readonly args: _RawValue[]
  readonly flags: Record<string, _RawValue[]>
  readonly unkArgs: string[]
  readonly unkFlags: string[]
}

type _RuntimeContext = HandlerContext<_Args, _Flags, Snippet[]>
type _ResolverUnit = _ResolverFn | _ResolverCtor
type _ResolverArray = readonly _ResolverFn[] | readonly _ResolverCtor[]

interface _RuntimeTweaks {
  readonly booleanNegation: boolean
  readonly negativeNumberValues: boolean
}

const default_tweaks: _RuntimeTweaks = {
  booleanNegation: true,
  negativeNumberValues: true,
}

// MARK: - diagnostics

function error(desc: string, diag?: _Message['diag']): _Message {
  return {
    level: 'error',
    desc,
    diag,
  }
}

function token_error(
  desc: string,
  argv: readonly string[],
  offset: number,
  markup: string,
): _Message {
  return error(desc, {
    source: argv,
    offset,
    markup,
    prefix: '> ',
  })
}

// MARK: - utils

function is_flag_token(token: string | undefined): token is string {
  return token?.startsWith('-') === true && token !== '-'
}

function has_fallback(param: Argument | Flag): boolean {
  return Object.hasOwn(param, 'fallback')
}

function is_required(param: Argument | Flag, fallback: boolean): boolean {
  return param.required ?? fallback
}

function is_array_resolver(
  resolver: Resolver | undefined,
): resolver is _ResolverArray {
  return Array.isArray(resolver)
}

function resolver_unit(
  resolver: Resolver | undefined,
): _ResolverUnit | undefined {
  if (resolver === undefined) return undefined
  if (is_array_resolver(resolver)) return resolver[0]
  return resolver
}

function is_boolean_resolver(resolver: Resolver | undefined): boolean {
  return resolver_unit(resolver) === Boolean
}

function can_read_as_value(
  token: string | undefined,
  resolver: Resolver | undefined,
  tweaks: _RuntimeTweaks,
): token is string {
  if (token === undefined) return false
  if (!is_flag_token(token)) return true
  if (!tweaks.negativeNumberValues) return false
  return resolver_unit(resolver) === Number && !Number.isNaN(Number(token))
}

function runtime_tweaks(config: AppConfig | undefined): _RuntimeTweaks {
  const tweaks = config?.tweaks

  if (!tweaks) return default_tweaks

  return {
    booleanNegation: tweaks.booleanNegation ?? default_tweaks.booleanNegation,
    negativeNumberValues:
      tweaks.negativeNumberValues ?? default_tweaks.negativeNumberValues,
  }
}

function resolve_unit(
  raw: string,
  resolver: _ResolverFn | _ResolverCtor = String,
): string | number | boolean | unknown {
  if (resolver === String) return raw
  if (resolver === Number) {
    const value = Number(raw)
    if (Number.isNaN(value)) throw new Error(`\`${raw}\` is not a valid number`)
    return value
  }
  if (resolver === Boolean) {
    if (raw === 'true' || raw === '1') return true
    if (raw === 'false' || raw === '0') return false
    throw new Error(`\`${raw}\` is not a valid boolean value`)
  }
  return resolver(raw)
}

function resolve_value(
  raw: readonly _RawValue[],
  resolver: Resolver | undefined,
): unknown {
  if (is_array_resolver(resolver)) {
    const unit = resolver_unit(resolver)
    if (!unit) throw new Error('Array resolver must contain a resolver')
    return raw.map(({ value }) => resolve_unit(value, unit))
  }
  return resolve_unit(raw[raw.length - 1]!.value, resolver_unit(resolver))
}

function resolve_raw(raw: _RawValue, resolver: Resolver | undefined): unknown {
  return resolve_unit(raw.value, resolver_unit(resolver))
}

// MARK: - snippets

function merge_params(cmd: _Commands[string]): _Params {
  const args: _Args = {}
  const flags: _Flags = {}

  for (const part of cmd.use ?? []) {
    Object.assign(args, part.args)
    Object.assign(flags, part.flags)
  }

  Object.assign(args, cmd.args)
  Object.assign(flags, cmd.flags)

  return { args, flags }
}

// MARK: - flag parsing

function flag_tokens(
  flags: _Flags,
  collector: _Collector,
): ReadonlyMap<string, string> {
  const map = new Map<string, string>()

  for (const [key, flag] of Object.entries(flags)) {
    if (!is_flag_name(key)) {
      collector.submit(
        error('Invalid flag schema', {
          source: key,
          offset: 0,
          markup: 'Flag name must not be empty or start with `-`',
        }),
      )
      continue
    }

    set_flag_token(map, `--${key}`, key, collector)
    if (flag.alias === undefined) continue

    for (const alias of to_array(flag.alias)) {
      if (!is_flag_alias(alias)) {
        collector.submit(
          error('Invalid flag schema', {
            source: alias,
            offset: 0,
            markup: `Alias for \`${key}\` must not be empty or start with \`-\``,
          }),
        )
        continue
      }

      set_flag_token(
        map,
        alias.length === 1 ? `-${alias}` : `--${alias}`,
        key,
        collector,
      )
    }
  }

  return map
}

function is_flag_name(key: string): boolean {
  return key.length > 0 && !key.startsWith('-')
}

function is_flag_alias(alias: string): boolean {
  return alias.length > 0 && !alias.startsWith('-')
}

function set_flag_token(
  map: Map<string, string>,
  token: string,
  key: string,
  collector: _Collector,
) {
  const existing = map.get(token)

  if (existing && existing !== key) {
    collector.submit(
      error('Invalid flag schema', {
        source: token,
        offset: 0,
        markup: `\`${token}\` is already used by \`${existing}\``,
      }),
    )
    return
  }

  map.set(token, key)
}

function split_flag(token: string): readonly [string, string | undefined] {
  const index = token.indexOf('=')
  if (index === -1) return [token, undefined]
  return [token.slice(0, index), token.slice(index + 1)]
}

function negated_boolean_key(
  name: string,
  inline: string | undefined,
  tokens: ReadonlyMap<string, string>,
  flags: _Flags,
  tweaks: _RuntimeTweaks,
): string | undefined {
  if (!tweaks.booleanNegation || inline !== undefined) return undefined
  if (!name.startsWith('--no-')) return undefined

  const key = tokens.get(`--${name.slice(5)}`)
  if (!key || !is_boolean_resolver(flags[key]?.resolver)) return undefined
  return key
}

function parse_argv(
  argv: readonly string[],
  offset: number,
  flags: _Flags,
  collector: _Collector,
  tweaks: _RuntimeTweaks,
): _ParsedArgv {
  const parsed: _ParsedArgv = {
    args: [],
    flags: {},
    unkArgs: [],
    unkFlags: [],
  }
  const tokens = flag_tokens(flags, collector)

  for (let i = offset; i < argv.length; i++) {
    const token = argv[i]!

    if (token === '--') {
      for (let j = i + 1; j < argv.length; j++) {
        parsed.args.push({ value: argv[j]!, offset: j, token: argv[j]! })
      }
      break
    }

    if (!is_flag_token(token)) {
      parsed.args.push({ value: token, offset: i, token })
      continue
    }

    const [name, inline] = split_flag(token)
    let key = tokens.get(name)
    let negated = false

    if (!key) {
      key = negated_boolean_key(name, inline, tokens, flags, tweaks)
      negated = key !== undefined
    }

    if (!key) {
      parsed.unkFlags.push(token)
      collector.submit(
        token_error(
          'Unknown flag occurred',
          argv,
          i,
          `\`${token}\` is not a known flag`,
        ),
      )
      continue
    }

    const flag = flags[key]!
    const values = (parsed.flags[key] ??= [])

    if (negated) {
      values.push({ value: 'false', offset: i, token })
      continue
    }

    if (inline !== undefined) {
      values.push({ value: inline, offset: i, token })
      continue
    }

    if (is_boolean_resolver(flag.resolver)) {
      values.push({ value: 'true', offset: i, token })
      continue
    }

    const next = argv[i + 1]
    if (!can_read_as_value(next, flag.resolver, tweaks)) {
      collector.submit(
        token_error(
          'Missing flag value',
          argv,
          i,
          `\`${token}\` requires a value`,
        ),
      )
      continue
    }

    i += 1
    values.push({ value: next, offset: i, token: next })
  }

  return parsed
}

// MARK: - parameter parsing

function parse_arg_values(
  argv: readonly string[],
  specs: _Args,
  values: readonly _RawValue[],
  unkArgs: string[],
  collector: _Collector,
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {}
  const entries = Object.entries(specs)
  let offset = 0

  for (let i = 0; i < entries.length; i++) {
    const [key, spec] = entries[i]!
    const isArray = is_array_resolver(spec.resolver)

    if (isArray && i < entries.length - 1) {
      collector.submit(
        error('Invalid argument schema', {
          source: key,
          offset: 0,
          markup: `\`${key}\` with an array resolver must be the last argument`,
        }),
      )
    }

    if (offset >= values.length) {
      if (has_fallback(spec)) parsed[key] = spec.fallback
      else if (is_required(spec, true)) {
        collector.submit(
          error('Missing required argument', {
            source: key,
            offset: 0,
            markup: `\`${key}\` is required`,
          }),
        )
      }
      continue
    }

    if (isArray) {
      const raw = values.slice(offset)
      offset = values.length

      try {
        parsed[key] = resolve_value(raw, spec.resolver)
      } catch (reason: unknown) {
        const first = raw[0]!
        collector.submit(
          token_error(
            'Invalid argument value',
            argv,
            first.offset,
            reason instanceof Error ? reason.message : `\`${key}\` is invalid`,
          ),
        )
      }

      break
    }

    const raw = values[offset]!
    offset += 1

    try {
      parsed[key] = resolve_raw(raw, spec.resolver)
    } catch (reason: unknown) {
      collector.submit(
        token_error(
          'Invalid argument value',
          argv,
          raw.offset,
          reason instanceof Error ? reason.message : `\`${key}\` is invalid`,
        ),
      )
    }
  }

  for (const raw of values.slice(offset)) {
    unkArgs.push(raw.value)
    collector.submit(
      token_error(
        'Unknown argument occurred',
        argv,
        raw.offset,
        `\`${raw.value}\` is not expected here`,
      ),
    )
  }

  return parsed
}

function parse_flag_values(
  argv: readonly string[],
  specs: _Flags,
  values: Record<string, _RawValue[]>,
  collector: _Collector,
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {}

  for (const [key, spec] of Object.entries(specs)) {
    const raw = values[key] ?? []

    if (raw.length === 0) {
      if (has_fallback(spec)) parsed[key] = spec.fallback
      else if (is_required(spec, false)) {
        collector.submit(
          error('Missing required flag', {
            source: `--${key}`,
            offset: 0,
            markup: `\`--${key}\` is required`,
          }),
        )
      }
      continue
    }

    if (!is_array_resolver(spec.resolver) && raw.length > 1) {
      collector.submit(
        error('Repeated flag occurred', {
          source: `--${key}`,
          offset: 0,
          markup: `\`--${key}\` does not accept multiple values`,
        }),
      )
    }

    try {
      parsed[key] = resolve_value(raw, spec.resolver)
    } catch (reason: unknown) {
      const first = raw[0]!
      collector.submit(
        token_error(
          'Invalid flag value',
          argv,
          first.offset,
          reason instanceof Error ? reason.message : `\`--${key}\` is invalid`,
        ),
      )
    }
  }

  return parsed
}

// MARK: - checking

async function run_checks(
  specs: _Args | _Flags,
  values: Record<string, unknown>,
  collector: _Collector,
) {
  for (const [key, spec] of Object.entries(specs)) {
    if (!spec.check || values[key] === undefined) continue

    try {
      const result = await spec.check({ value: values[key] as never })

      if (result === true || result === undefined) continue

      collector.submit(check_failed(key, result))
    } catch (reason: unknown) {
      collector.submit(check_failed(key, reason))
    }
  }
}

function check_failed(key: string, reason: unknown): _Message {
  return error('Check failed', {
    source: key,
    offset: 0,
    markup: check_markup(key, reason),
  })
}

function check_markup(key: string, reason: unknown): string {
  if (typeof reason === 'string' && reason.length > 0) return reason
  if (reason instanceof Error && reason.message.length > 0)
    return reason.message
  if (reason !== false && reason !== undefined) return String(reason)
  return `\`${key}\` did not pass its check`
}

// MARK: - context

export async function create_context(
  app: App,
  cmd: _Commands[string],
  argv: readonly string[],
  offset: number,
  collector: _Collector,
): Promise<_RuntimeContext> {
  const params = merge_params(cmd)
  const tweaks = runtime_tweaks(app.config)
  const parsed = parse_argv(argv, offset, params.flags, collector, tweaks)
  const args = parse_arg_values(
    argv,
    params.args,
    parsed.args,
    parsed.unkArgs,
    collector,
  )
  const flags = parse_flag_values(argv, params.flags, parsed.flags, collector)

  await run_checks(params.args, args, collector)
  await run_checks(params.flags, flags, collector)

  return {
    args: args as _RuntimeContext['args'],
    flags: flags as _RuntimeContext['flags'],
    unkArgs: parsed.unkArgs,
    unkFlags: parsed.unkFlags,
    __internal__: {
      app,
    },
  }
}
