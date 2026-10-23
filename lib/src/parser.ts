/**
 * @license MIT
 * @file One token-processing path for command selection and flag parsing.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { invalid_command } from './errors'
import {
  is_array_resolver,
  is_boolean,
  resolver_unit,
  type _Action,
  type _Node,
} from './schema'
import { suggest_hint } from './suggest'
import type {
  _Flags,
  _Message,
  AppConfig,
  AppTweaks,
  Argument,
  Flag,
  Resolver,
} from './types'

export interface _RawValue {
  readonly value: string
  readonly offset: number
  readonly token: string
}

export interface _ParsedArgv {
  readonly args: _RawValue[]
  readonly flags: Record<string, _RawValue[]>
  readonly unkArgs: string[]
  readonly unkFlags: string[]
}

export interface _Invocation {
  readonly action: _Action
  readonly argv: readonly string[]
  readonly parsed: _ParsedArgv
  readonly messages: readonly _Message[]
}

interface _ParseEnv {
  readonly argv: readonly string[]
  readonly args: readonly Argument[]
  readonly flags: _Flags
  readonly tokens: ReadonlyMap<string, string>
  readonly children: ReadonlyMap<string, _Node>
  readonly report: (message: _Message) => void
  readonly tweaks: Required<AppTweaks>
}

interface _ScanState {
  node: _Node
  routing: boolean
}

const no_children: ReadonlyMap<string, _Node> = new Map()

function empty_argv(): _ParsedArgv {
  return {
    args: [],
    flags: Object.create(null) as Record<string, _RawValue[]>,
    unkArgs: [],
    unkFlags: [],
  }
}

function runtime_tweaks(
  config: AppConfig | undefined,
): Required<AppTweaks> {
  const tweaks = config?.tweaks
  return {
    booleanNegation: tweaks?.booleanNegation ?? true,
    shortBooleanClusters: tweaks?.shortBooleanClusters ?? true,
    variadicFlagValues: tweaks?.variadicFlagValues ?? true,
    negativeNumberValues: tweaks?.negativeNumberValues ?? true,
  }
}

// MARK: - values

function is_flag_token(token: string | undefined): token is string {
  return token?.startsWith('-') === true && token !== '-'
}

function can_read_as_value(
  token: string | undefined,
  resolver: Resolver | undefined,
  tweaks: Required<AppTweaks>,
): token is string {
  if (token === undefined) return false
  if (!is_flag_token(token)) return true
  if (!tweaks.negativeNumberValues) return false
  return resolver_unit(resolver) === Number && !Number.isNaN(Number(token))
}

function split_flag(token: string): readonly [string, string | undefined] {
  const index = token.indexOf('=')
  return index === -1
    ? [token, undefined]
    : [token.slice(0, index), token.slice(index + 1)]
}

function split_array_value(value: string): readonly string[] {
  return value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function can_read_as_array_value(
  token: string | undefined,
  resolver: Resolver | undefined,
  env: _ParseEnv,
): token is string {
  if (token === undefined || env.children.has(token)) return false
  if (!is_flag_token(token)) return true
  if (
    !env.tweaks.negativeNumberValues ||
    resolver_unit(resolver) !== Number
  ) {
    return false
  }
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
    if (!Object.hasOwn(arg, 'fallback') && (arg.required ?? true)) {
      required += 1
    }
    if (is_array_resolver(arg.resolver)) return required
  }
  return required
}

function push_flag_value(
  parsed: _ParsedArgv,
  key: string,
  value: string,
  offset: number,
  token: string,
  split = false,
): void {
  const values = (parsed.flags[key] ??= [])
  const items =
    split && value.includes(',') ? split_array_value(value) : [value]
  for (const item of items) values.push({ value: item, offset, token })
}

function array_value_end(
  offset: number,
  resolver: Resolver | undefined,
  used: number,
  env: _ParseEnv,
): number {
  let end = offset + 1
  const comma = env.argv[offset]!.includes(',')
  while (can_read_as_array_value(env.argv[end], resolver, env)) {
    if (comma && !ends_with_comma(env.argv[end - 1]!)) break
    end += 1
  }
  // Parent positionals do not constrain values while selecting a child.
  // Once at a leaf (or after positional input), reserve local required args.
  if (comma || env.children.size > 0) return end
  const available = end - offset
  return (
    offset + Math.max(1, available - required_args_left(env.args, used))
  )
}

function read_array_values(
  parsed: _ParsedArgv,
  key: string,
  flag: Flag,
  offset: number,
  env: _ParseEnv,
): number | undefined {
  if (!env.tweaks.variadicFlagValues || !is_array_resolver(flag.resolver)) {
    return undefined
  }
  if (!can_read_as_array_value(env.argv[offset], flag.resolver, env)) {
    return undefined
  }
  const end = array_value_end(
    offset,
    flag.resolver,
    parsed.args.length,
    env,
  )
  for (let i = offset; i < end; i += 1) {
    push_flag_value(parsed, key, env.argv[i]!, i, env.argv[i]!, true)
  }
  return end
}

function read_array_continuation(
  parsed: _ParsedArgv,
  key: string,
  flag: Flag,
  offset: number,
  env: _ParseEnv,
): number {
  let end = offset
  while (
    can_read_as_array_value(env.argv[end], flag.resolver, env) &&
    ends_with_comma(env.argv[end - 1]!)
  ) {
    push_flag_value(parsed, key, env.argv[end]!, end, env.argv[end]!, true)
    end += 1
  }
  return end
}

// MARK: - flags

function boolean_key(token: string, env: _ParseEnv): string | undefined {
  const key = env.tokens.get(token)
  return key && is_boolean(env.flags[key]?.resolver) ? key : undefined
}

function negated_key(
  name: string,
  inline: string | undefined,
  env: _ParseEnv,
): string | undefined {
  if (
    !env.tweaks.booleanNegation ||
    inline !== undefined ||
    !name.startsWith('--no-')
  ) {
    return undefined
  }
  return boolean_key(`--${name.slice(5)}`, env)
}

function cluster_keys(
  name: string,
  inline: string | undefined,
  env: _ParseEnv,
): readonly string[] | undefined {
  if (!env.tweaks.shortBooleanClusters || inline !== undefined) {
    return undefined
  }
  if (name.startsWith('--') || !name.startsWith('-') || name.length <= 2) {
    return undefined
  }
  const keys: string[] = []
  for (const char of name.slice(1)) {
    const key = boolean_key(`-${char}`, env)
    if (!key) return undefined
    keys.push(key)
  }
  return keys
}

function flag_candidates(env: _ParseEnv): readonly string[] {
  const names = [...env.tokens.keys()]
  if (!env.tweaks.booleanNegation) return names
  for (const [token, key] of env.tokens) {
    if (token.startsWith('--') && is_boolean(env.flags[key]?.resolver)) {
      names.push(`--no-${token.slice(2)}`)
    }
  }
  return names
}

function unknown_flag(
  parsed: _ParsedArgv,
  token: string,
  offset: number,
  env: _ParseEnv,
): void {
  parsed.unkFlags.push(token)
  env.report({
    level: 'error',
    desc: 'Unknown flag occurred',
    diag: {
      source: env.argv,
      offset,
      prefix: '> ',
      markup: `\`${token}\` is not a known flag`,
      hint: suggest_hint(token.split('=')[0]!, flag_candidates(env)),
    },
  })
}

function read_separate_value(
  parsed: _ParsedArgv,
  key: string,
  token: string,
  flag: Flag,
  offset: number,
  env: _ParseEnv,
): number {
  if (is_boolean(flag.resolver)) {
    push_flag_value(parsed, key, 'true', offset, token)
    return offset
  }
  const end = read_array_values(parsed, key, flag, offset + 1, env)
  if (end !== undefined) return end - 1
  const next = env.argv[offset + 1]
  if (!can_read_as_value(next, flag.resolver, env.tweaks)) {
    env.report({
      level: 'error',
      desc: 'Missing flag value',
      diag: {
        source: env.argv,
        offset,
        prefix: '> ',
        markup: `\`${token}\` requires a value`,
      },
    })
    return offset
  }
  push_flag_value(parsed, key, next, offset + 1, next)
  return offset + 1
}

function read_known_flag(
  parsed: _ParsedArgv,
  key: string,
  token: string,
  inline: string | undefined,
  offset: number,
  env: _ParseEnv,
): number {
  const flag = env.flags[key]!
  if (inline === undefined) {
    return read_separate_value(parsed, key, token, flag, offset, env)
  }
  const split =
    env.tweaks.variadicFlagValues && is_array_resolver(flag.resolver)
  push_flag_value(parsed, key, inline, offset, token, split)
  return split && ends_with_comma(inline)
    ? read_array_continuation(parsed, key, flag, offset + 1, env) - 1
    : offset
}

function parse_flag_token(
  parsed: _ParsedArgv,
  token: string,
  offset: number,
  env: _ParseEnv,
): number {
  const [name, inline] = split_flag(token)
  const direct = env.tokens.get(name)
  if (direct !== undefined) {
    return read_known_flag(parsed, direct, token, inline, offset, env)
  }
  const negated = negated_key(name, inline, env)
  if (negated !== undefined) {
    push_flag_value(parsed, negated, 'false', offset, token)
    return offset
  }
  const keys = cluster_keys(name, inline, env)
  if (keys) {
    for (const key of keys) {
      push_flag_value(parsed, key, 'true', offset, token)
    }
  } else {
    unknown_flag(parsed, token, offset, env)
  }
  return offset
}

// MARK: - command selection

function needs_command(node: _Node): boolean {
  return (
    !node.spec.handler ||
    (node.children.size > 0 && Object.keys(node.params.args).length === 0)
  )
}

function select_or_append(
  state: _ScanState,
  parsed: _ParsedArgv,
  argv: readonly string[],
  offset: number,
  report: (message: _Message) => void,
): void {
  const token = argv[offset]!
  const child = state.routing ? state.node.children.get(token) : undefined
  if (child) {
    state.node = child
    return
  }
  if (state.routing && needs_command(state.node)) {
    report(invalid_command(argv, offset, token, state.node.children.keys()))
  }
  state.routing = false
  parsed.args.push({ value: token, offset, token })
}

function selected_action(node: _Node, parsed: _ParsedArgv): _Action {
  const candidates = node.actions
    .filter(({ key }) => {
      const value = parsed.flags[key]?.at(-1)?.value
      return value === 'true' || value === '1'
    })
    .map(({ action }) => action)
  return [node.action, ...candidates].sort(
    (a, b) => a.priority - b.priority,
  )[0]!
}

/**
 * Selects commands and reads values in the same pass, retaining source
 * offsets. An option-bound command starts its own invocation rather than
 * inheriting the arguments or diagnostics of the action it replaces.
 */
export function parse(
  root: _Node,
  argv: readonly string[],
  config?: AppConfig,
  offset: number = 2,
): _Invocation {
  const state: _ScanState = { node: root, routing: true }
  const parsed = empty_argv()
  const messages: _Message[] = []
  const report = (message: _Message): void => {
    messages.push(message)
  }
  const tweaks = runtime_tweaks(config)
  for (let i = offset; i < argv.length; i += 1) {
    const token = argv[i]!
    if (token === '--') {
      for (let j = i + 1; j < argv.length; j += 1) {
        parsed.args.push({ value: argv[j]!, offset: j, token: argv[j]! })
      }
      break
    }
    if (!is_flag_token(token)) {
      select_or_append(state, parsed, argv, i, report)
      continue
    }
    const env: _ParseEnv = {
      argv,
      args: Object.values(state.node.params.args),
      flags: state.node.flags,
      tokens: state.node.tokens,
      children: state.routing ? state.node.children : no_children,
      report,
      tweaks,
    }
    i = parse_flag_token(parsed, token, i, env)
  }
  const action = selected_action(state.node, parsed)
  return action === state.node.action
    ? { action, argv, parsed, messages }
    : { action, argv, parsed: empty_argv(), messages: [] }
}
