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

/**
 * Immutable parse context shared by all flag-parsing helpers.
 *
 * Bundling the per-run inputs into one object keeps the helper signatures
 * short, so the parse loop can reuse the same context for every token.
 */
interface _ParseEnv {
  readonly argv: readonly string[]
  readonly args: readonly Argument[]
  readonly flags: _Flags
  readonly tokens: ReadonlyMap<string, string>
  readonly collector: _Collector
  readonly tweaks: _RuntimeTweaks
}

type _RuntimeContext = HandlerContext<_Args, _Flags, Snippet[]>
type _ResolverUnit = _ResolverFn | _ResolverCtor
type _ResolverArray = readonly _ResolverFn[] | readonly _ResolverCtor[]

interface _RuntimeTweaks {
  readonly booleanNegation: boolean
  readonly shortBooleanClusters: boolean
  readonly variadicFlagValues: boolean
  readonly negativeNumberValues: boolean
}

const default_tweaks: _RuntimeTweaks = {
  booleanNegation: true,
  shortBooleanClusters: true,
  variadicFlagValues: true,
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
    booleanNegation:
      tweaks.booleanNegation ?? default_tweaks.booleanNegation,
    shortBooleanClusters:
      tweaks.shortBooleanClusters ?? default_tweaks.shortBooleanClusters,
    variadicFlagValues:
      tweaks.variadicFlagValues ?? default_tweaks.variadicFlagValues,
    negativeNumberValues:
      tweaks.negativeNumberValues ?? default_tweaks.negativeNumberValues,
  }
}

function resolve_unit(
  raw: string,
  resolver: _ResolverFn | _ResolverCtor = String,
): unknown {
  if (resolver === String) return raw
  if (resolver === Number) {
    const value = Number(raw)
    if (Number.isNaN(value)) {
      throw new Error(`\`${raw}\` is not a valid number`)
    }
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

function resolve_raw(
  raw: _RawValue,
  resolver: Resolver | undefined,
): unknown {
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

function split_array_value(value: string): readonly string[] {
  const values: string[] = []

  for (const part of value.split(',')) {
    const item = part.trim()
    if (item.length > 0) values.push(item)
  }

  return values
}

function boolean_flag_key(
  token: string,
  tokens: ReadonlyMap<string, string>,
  flags: _Flags,
): string | undefined {
  const key = tokens.get(token)
  if (!key || !is_boolean_resolver(flags[key]?.resolver)) return undefined
  return key
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

  return boolean_flag_key(`--${name.slice(5)}`, tokens, flags)
}

function short_boolean_cluster_keys(
  name: string,
  inline: string | undefined,
  tokens: ReadonlyMap<string, string>,
  flags: _Flags,
  tweaks: _RuntimeTweaks,
): readonly string[] | undefined {
  if (!tweaks.shortBooleanClusters || inline !== undefined) return undefined
  if (name.startsWith('--') || !name.startsWith('-') || name.length <= 2) {
    return undefined
  }

  const keys: string[] = []

  for (let i = 1; i < name.length; i += 1) {
    const key = boolean_flag_key(`-${name[i]!}`, tokens, flags)
    if (!key) return undefined
    keys.push(key)
  }

  return keys
}

function push_flag_value(
  parsed: _ParsedArgv,
  key: string,
  value: string,
  offset: number,
  token: string,
  split = false,
) {
  const values = (parsed.flags[key] ??= [])

  if (!split || !value.includes(',')) {
    values.push({ value, offset, token })
    return
  }

  for (const part of split_array_value(value)) {
    values.push({ value: part, offset, token })
  }
}

function can_read_as_array_value(
  token: string | undefined,
  resolver: Resolver | undefined,
  tweaks: _RuntimeTweaks,
): token is string {
  if (token === undefined) return false
  if (!is_flag_token(token)) return true
  if (!tweaks.negativeNumberValues) return false
  if (resolver_unit(resolver) !== Number) return false
  if (!token.includes(',')) return !Number.isNaN(Number(token))

  const values = split_array_value(token)
  return (
    values.length > 0 &&
    values.every((value) => !Number.isNaN(Number(value)))
  )
}

function ends_with_comma(value: string): boolean {
  return value.trimEnd().endsWith(',')
}

function required_args_left(
  args: readonly Argument[],
  used: number,
): number {
  let consumed = used
  let required = 0

  for (const arg of args) {
    if (consumed > 0) {
      if (is_array_resolver(arg.resolver)) return 0
      consumed -= 1
      continue
    }

    if (!has_fallback(arg) && is_required(arg, true)) required += 1
    if (is_array_resolver(arg.resolver)) return required
  }

  return required
}

function comma_value_end(
  argv: readonly string[],
  offset: number,
  resolver: Resolver | undefined,
  tweaks: _RuntimeTweaks,
): number | undefined {
  if (!argv[offset]?.includes(',')) return undefined

  let end = offset + 1

  while (
    ends_with_comma(argv[end - 1]!) &&
    can_read_as_array_value(argv[end], resolver, tweaks)
  ) {
    end += 1
  }

  return end
}

function plain_value_end(
  argv: readonly string[],
  offset: number,
  resolver: Resolver | undefined,
  args: readonly Argument[],
  parsedArgs: number,
  tweaks: _RuntimeTweaks,
): number {
  let end = offset + 1

  while (can_read_as_array_value(argv[end], resolver, tweaks)) end += 1

  const available = end - offset
  const reserved = required_args_left(args, parsedArgs)
  const count = Math.max(1, available - reserved)

  return offset + count
}

function push_array_flag_values(
  parsed: _ParsedArgv,
  key: string,
  argv: readonly string[],
  offset: number,
  end: number,
) {
  for (let i = offset; i < end; i += 1) {
    const token = argv[i]!
    push_flag_value(parsed, key, token, i, token, true)
  }
}

function read_array_flag_values(
  parsed: _ParsedArgv,
  key: string,
  flag: Flag,
  argv: readonly string[],
  offset: number,
  args: readonly Argument[],
  tweaks: _RuntimeTweaks,
): number | undefined {
  if (!tweaks.variadicFlagValues || !is_array_resolver(flag.resolver)) {
    return undefined
  }
  if (!can_read_as_array_value(argv[offset], flag.resolver, tweaks)) {
    return undefined
  }

  const end =
    comma_value_end(argv, offset, flag.resolver, tweaks) ??
    plain_value_end(
      argv,
      offset,
      flag.resolver,
      args,
      parsed.args.length,
      tweaks,
    )

  push_array_flag_values(parsed, key, argv, offset, end)

  return end
}

function read_array_flag_continuation(
  parsed: _ParsedArgv,
  key: string,
  flag: Flag,
  argv: readonly string[],
  offset: number,
  tweaks: _RuntimeTweaks,
): number {
  let end = offset

  while (
    can_read_as_array_value(argv[end], flag.resolver, tweaks) &&
    ends_with_comma(argv[end - 1]!)
  ) {
    const token = argv[end]!
    push_flag_value(parsed, key, token, end, token, true)
    end += 1
  }

  return end
}

function append_positionals(
  parsed: _ParsedArgv,
  env: _ParseEnv,
  offset: number,
): void {
  for (let i = offset; i < env.argv.length; i += 1) {
    parsed.args.push({
      value: env.argv[i]!,
      offset: i,
      token: env.argv[i]!,
    })
  }
}

function unknown_flag(
  parsed: _ParsedArgv,
  token: string,
  offset: number,
  env: _ParseEnv,
): void {
  parsed.unkFlags.push(token)
  env.collector.submit(
    token_error(
      'Unknown flag occurred',
      env.argv,
      offset,
      `\`${token}\` is not a known flag`,
    ),
  )
}

function missing_flag_value(
  token: string,
  offset: number,
  env: _ParseEnv,
): void {
  env.collector.submit(
    token_error(
      'Missing flag value',
      env.argv,
      offset,
      `\`${token}\` requires a value`,
    ),
  )
}

function resolve_flag_key(
  name: string,
  inline: string | undefined,
  env: _ParseEnv,
): { key: string; negated: boolean } | undefined {
  const direct = env.tokens.get(name)
  if (direct) return { key: direct, negated: false }

  const negatedKey = negated_boolean_key(
    name,
    inline,
    env.tokens,
    env.flags,
    env.tweaks,
  )
  if (negatedKey) return { key: negatedKey, negated: true }

  return undefined
}

function read_separate_flag_value(
  parsed: _ParsedArgv,
  key: string,
  token: string,
  flag: Flag,
  offset: number,
  env: _ParseEnv,
): number {
  if (is_boolean_resolver(flag.resolver)) {
    push_flag_value(parsed, key, 'true', offset, token)
    return offset
  }

  const end = read_array_flag_values(
    parsed,
    key,
    flag,
    env.argv,
    offset + 1,
    env.args,
    env.tweaks,
  )

  if (end !== undefined) return end - 1

  const next = env.argv[offset + 1]
  if (!can_read_as_value(next, flag.resolver, env.tweaks)) {
    missing_flag_value(token, offset, env)
    return offset
  }

  push_flag_value(parsed, key, next, offset + 1, next)
  return offset + 1
}

function parse_flag_token(
  parsed: _ParsedArgv,
  token: string,
  name: string,
  inline: string | undefined,
  offset: number,
  env: _ParseEnv,
): number {
  const resolved = resolve_flag_key(name, inline, env)

  if (!resolved) {
    const keys = short_boolean_cluster_keys(
      name,
      inline,
      env.tokens,
      env.flags,
      env.tweaks,
    )

    if (keys) {
      for (const clusterKey of keys) {
        push_flag_value(parsed, clusterKey, 'true', offset, token)
      }
      return offset
    }

    unknown_flag(parsed, token, offset, env)
    return offset
  }

  const { key, negated } = resolved
  const flag = env.flags[key]!

  if (negated) {
    push_flag_value(parsed, key, 'false', offset, token)
    return offset
  }

  if (inline !== undefined) {
    const split =
      env.tweaks.variadicFlagValues && is_array_resolver(flag.resolver)
    push_flag_value(parsed, key, inline, offset, token, split)

    if (split && ends_with_comma(inline)) {
      return (
        read_array_flag_continuation(
          parsed,
          key,
          flag,
          env.argv,
          offset + 1,
          env.tweaks,
        ) - 1
      )
    }

    return offset
  }

  return read_separate_flag_value(parsed, key, token, flag, offset, env)
}

function parse_argv(
  argv: readonly string[],
  offset: number,
  args: _Args,
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
  const env: _ParseEnv = {
    argv,
    args: Object.values(args),
    flags,
    tokens: flag_tokens(flags, collector),
    collector,
    tweaks,
  }

  for (let i = offset; i < argv.length; i += 1) {
    const token = argv[i]!

    if (token === '--') {
      append_positionals(parsed, env, i + 1)
      break
    }

    if (!is_flag_token(token)) {
      parsed.args.push({ value: token, offset: i, token })
      continue
    }

    const [name, inline] = split_flag(token)
    i = parse_flag_token(parsed, token, name, inline, i, env)
  }

  return parsed
}

// MARK: - parameter parsing

function resolver_failure(reason: unknown, fallback: string): string {
  return reason instanceof Error ? reason.message : fallback
}

function resolve_arg_value(
  argv: readonly string[],
  key: string,
  raw: _RawValue,
  resolver: Resolver | undefined,
  parsed: Record<string, unknown>,
  collector: _Collector,
): void {
  try {
    parsed[key] = resolve_raw(raw, resolver)
  } catch (reason: unknown) {
    collector.submit(
      token_error(
        'Invalid argument value',
        argv,
        raw.offset,
        resolver_failure(reason, `\`${key}\` is invalid`),
      ),
    )
  }
}

function resolve_arg_values(
  argv: readonly string[],
  key: string,
  raw: readonly _RawValue[],
  resolver: Resolver | undefined,
  parsed: Record<string, unknown>,
  collector: _Collector,
): void {
  try {
    parsed[key] = resolve_value(raw, resolver)
  } catch (reason: unknown) {
    const first = raw[0]!
    collector.submit(
      token_error(
        'Invalid argument value',
        argv,
        first.offset,
        resolver_failure(reason, `\`${key}\` is invalid`),
      ),
    )
  }
}

function apply_default(
  key: string,
  spec: Argument | Flag,
  source: string,
  requiredDefault: boolean,
  desc: string,
  parsed: Record<string, unknown>,
  collector: _Collector,
): void {
  if (has_fallback(spec)) {
    parsed[key] = spec.fallback
    return
  }
  if (!is_required(spec, requiredDefault)) return

  collector.submit(
    error(desc, {
      source,
      offset: 0,
      markup: `\`${source}\` is required`,
    }),
  )
}

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

  for (let i = 0; i < entries.length; i += 1) {
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
      apply_default(
        key,
        spec,
        key,
        true,
        'Missing required argument',
        parsed,
        collector,
      )
      continue
    }

    if (isArray) {
      const raw = values.slice(offset)
      offset = values.length
      resolve_arg_values(argv, key, raw, spec.resolver, parsed, collector)
      break
    }

    const raw = values[offset]!
    offset += 1
    resolve_arg_value(argv, key, raw, spec.resolver, parsed, collector)
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

function apply_default_flag(
  key: string,
  spec: Flag,
  parsed: Record<string, unknown>,
  collector: _Collector,
): void {
  apply_default(
    key,
    spec,
    `--${key}`,
    false,
    'Missing required flag',
    parsed,
    collector,
  )
}

function resolve_flag_value(
  argv: readonly string[],
  key: string,
  raw: readonly _RawValue[],
  resolver: Resolver | undefined,
  parsed: Record<string, unknown>,
  collector: _Collector,
): void {
  try {
    parsed[key] = resolve_value(raw, resolver)
  } catch (reason: unknown) {
    const first = raw[0]!
    collector.submit(
      token_error(
        'Invalid flag value',
        argv,
        first.offset,
        resolver_failure(reason, `\`--${key}\` is invalid`),
      ),
    )
  }
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
      apply_default_flag(key, spec, parsed, collector)
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

    resolve_flag_value(argv, key, raw, spec.resolver, parsed, collector)
  }

  return parsed
}

// MARK: - checking

async function run_checks(
  specs: _Args | _Flags,
  values: Record<string, unknown>,
  collector: _Collector,
) {
  const entries = Object.entries(specs)

  const results = await Promise.all(
    entries.map(async ([key, spec]) => {
      if (spec.check === undefined || values[key] === undefined) {
        return undefined
      }

      try {
        const result = await spec.check({ value: values[key] as never })
        return { key, result }
      } catch (reason: unknown) {
        return { key, result: reason }
      }
    }),
  )

  for (const entry of results) {
    if (entry === undefined) continue
    if (entry.result === true || entry.result === undefined) continue
    collector.submit(check_failed(entry.key, entry.result))
  }
}

function check_failed(key: string, reason: unknown): _Message {
  return error('Check failed', {
    source: key,
    offset: 0,
    markup: check_markup(key, reason),
  })
}

function reason_text(reason: unknown): string {
  if (typeof reason === 'object' && reason !== null) {
    return JSON.stringify(reason) ?? Object.prototype.toString.call(reason)
  }
  return String(reason)
}

function check_markup(key: string, reason: unknown): string {
  if (typeof reason === 'string' && reason.length > 0) return reason
  if (reason instanceof Error && reason.message.length > 0) {
    return reason.message
  }
  if (reason !== false && reason !== undefined) {
    return reason_text(reason)
  }
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
  const parsed = parse_argv(
    argv,
    offset,
    params.args,
    params.flags,
    collector,
    tweaks,
  )
  const args = parse_arg_values(
    argv,
    params.args,
    parsed.args,
    parsed.unkArgs,
    collector,
  )
  const flags = parse_flag_values(
    argv,
    params.flags,
    parsed.flags,
    collector,
  )

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
