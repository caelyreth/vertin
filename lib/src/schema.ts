/**
 * @license MIT
 * @file Command preparation: shared schemas, scopes and token indexes.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import type {
  _Args,
  _Collector,
  _Commands,
  _Flags,
  _Message,
  _Result,
  _ResolverCtor,
  _ResolverFn,
  App,
  Flag,
  Resolver,
  Snippet,
} from './types'
import { err, is_err, ok, to_array } from './utils'

export interface _Params {
  readonly args: _Args
  readonly flags: _Flags
}

export type _ExecutableCommand = _Commands[string] & {
  readonly handler: NonNullable<_Commands[string]['handler']>
}

export interface _InternalCommand {
  readonly name: string
  readonly command: _ExecutableCommand
  readonly option?: Flag
  readonly mount: boolean
}

export interface _Action {
  readonly command: _ExecutableCommand
  readonly params: _Params
  readonly scope: () => _Node
  readonly priority: number
}

export interface _Node {
  readonly spec: _Commands[string]
  readonly path: readonly string[]
  readonly params: _Params
  readonly flags: _Flags
  readonly tokens: ReadonlyMap<string, string>
  readonly children: Map<string, _Node>
  readonly sub: Map<string, _Node>
  readonly actions: { readonly key: string; readonly action: _Action }[]
  readonly action: _Action
}

// MARK: - parameter schemas

export function merge_params(
  cmd: Snippet & { readonly use?: Snippet[] },
): _Params {
  const args = Object.create(null) as _Args
  const flags = Object.create(null) as _Flags
  for (const part of cmd.use ?? []) {
    Object.assign(args, part.args)
    Object.assign(flags, part.flags)
  }
  Object.assign(args, cmd.args)
  Object.assign(flags, cmd.flags)
  return { args, flags }
}

export function extend_flags(
  parent: _Flags,
  local: _Flags,
): _Result<_Flags, _Message> {
  for (const [key, flag] of Object.entries(local)) {
    if (Object.hasOwn(parent, key) && parent[key] !== flag) {
      return err(
        schema_error(
          'flag',
          key,
          `\`${key}\` is already defined in a parent scope`,
        ),
      )
    }
  }
  return ok({ ...parent, ...local })
}

export function flag_names(key: string, flag: Flag): readonly string[] {
  return [
    `--${key}`,
    ...to_array(flag.alias ?? []).map((alias) =>
      alias.length === 1 ? `-${alias}` : `--${alias}`,
    ),
  ]
}

export function is_array_resolver(
  resolver: Resolver | undefined,
): resolver is readonly _ResolverFn[] | readonly _ResolverCtor[] {
  return Array.isArray(resolver)
}

export function resolver_unit(
  resolver: Resolver | undefined,
): _ResolverFn | _ResolverCtor | undefined {
  return is_array_resolver(resolver) ? resolver[0] : resolver
}

export function is_boolean(resolver: Resolver | undefined): boolean {
  return resolver_unit(resolver) === Boolean
}

// MARK: - token indexes

function schema_error(
  kind: 'command' | 'flag',
  source: string,
  markup: string,
): _Message {
  return {
    level: 'error',
    desc: `Invalid ${kind} schema`,
    diag: { source, offset: 0, markup },
  }
}

function valid_name(name: string): boolean {
  return name.length > 0 && !name.startsWith('-') && !/\s/.test(name)
}

function register_name(
  names: Map<string, string>,
  name: string,
  key: string,
  kind: 'command' | 'flag',
): _Message | undefined {
  const existing = names.get(name)
  if (existing !== undefined && existing !== key) {
    return schema_error(
      kind,
      name,
      `\`${name}\` is already used by \`${existing}\``,
    )
  }
  names.set(name, key)
  return undefined
}

export function command_names(
  commands: _Commands = {},
): _Result<ReadonlyMap<string, string>, _Message> {
  const names = new Map<string, string>()
  for (const key of Object.keys(commands)) {
    if (!valid_name(key)) {
      return err(
        schema_error(
          'command',
          key,
          'Command names must be nonempty tokens without a leading `-`',
        ),
      )
    }
    names.set(key, key)
  }
  for (const [key, cmd] of Object.entries(commands)) {
    for (const alias of to_array(cmd.alias ?? [])) {
      if (!valid_name(alias)) {
        return err(
          schema_error(
            'command',
            alias,
            'Command aliases must be nonempty tokens without a leading `-`',
          ),
        )
      }
      const failure = register_name(names, alias, key, 'command')
      if (failure) return err(failure)
    }
  }
  return ok(names)
}

function flag_tokens(
  flags: _Flags,
  collector: _Collector,
): ReadonlyMap<string, string> {
  const tokens = new Map<string, string>()
  for (const [key, flag] of Object.entries(flags)) {
    if (!valid_name(key)) {
      collector.submit(
        schema_error(
          'flag',
          key,
          'Flag name must not be empty or start with `-`',
        ),
      )
      continue
    }
    const aliases = to_array(flag.alias ?? []).filter((alias) => {
      if (valid_name(alias)) return true
      collector.submit(
        schema_error(
          'flag',
          alias,
          `Alias for \`${key}\` must not be empty or start with \`-\``,
        ),
      )
      return false
    })
    for (const token of flag_names(key, { ...flag, alias: aliases })) {
      const failure = register_name(tokens, token, key, 'flag')
      if (failure) collector.submit(failure)
    }
  }
  return tokens
}

// MARK: - preparation

function validate_args(args: _Args, collector: _Collector): void {
  const entries = Object.entries(args)
  for (const [index, [key, param]] of entries.entries()) {
    if (is_array_resolver(param.resolver) && index < entries.length - 1) {
      collector.submit({
        level: 'error',
        desc: 'Invalid argument schema',
        diag: {
          source: key,
          offset: 0,
          markup: `\`${key}\` with an array resolver must be the last argument`,
        },
      })
    }
  }
}

function scoped_flags(
  parent: _Flags,
  local: _Flags,
  collector: _Collector,
): _Flags {
  const flags = extend_flags(parent, local)
  if (!is_err(flags)) return flags.value
  collector.submit(flags.errors)
  return parent
}

function mount_internal(
  node: _Node,
  definitions: readonly _InternalCommand[],
  collector: _Collector,
): void {
  for (const [priority, definition] of definitions.entries()) {
    const action: _Action = {
      command: definition.command,
      params: merge_params(definition.command),
      scope: () => node,
      priority,
    }
    if (definition.option) {
      node.actions.push({ key: definition.name, action })
    }
    if (!definition.mount || node.sub.size === 0) continue
    if (node.children.has(definition.name)) {
      collector.submit(
        schema_error(
          'command',
          definition.name,
          `\`${definition.name}\` is reserved; disable its built-in handling to reclaim it`,
        ),
      )
      continue
    }
    const child: _Node = {
      spec: definition.command,
      path: [...node.path, definition.name],
      params: action.params,
      flags: node.flags,
      tokens: node.tokens,
      children: new Map(),
      sub: new Map(),
      actions: node.actions,
      action,
    }
    node.children.set(definition.name, child)
    node.sub.set(definition.name, child)
  }
}

function prepare_node(
  spec: _Commands[string],
  path: readonly string[],
  inherited: _Flags,
  definitions: readonly [_InternalCommand, ..._InternalCommand[]],
  collector: _Collector,
): _Node {
  const local = merge_params(spec)
  validate_args(local.args, collector)
  const params = {
    args: local.args,
    flags: scoped_flags(inherited, local.flags, collector),
  }
  const options = Object.fromEntries(
    definitions
      .filter((definition) => definition.option)
      .map((definition) => [definition.name, definition.option!]),
  )
  const flags = scoped_flags(params.flags, options, collector)
  const fallback = definitions[0].command
  const command = spec.handler
    ? { ...spec, handler: spec.handler }
    : fallback
  const node: _Node = {
    spec,
    path,
    params,
    flags,
    tokens: flag_tokens(flags, collector),
    children: new Map(),
    sub: new Map(),
    actions: [],
    action: {
      command,
      params: spec.handler ? params : { args: {}, flags: {} },
      scope: () => node,
      priority: Infinity,
    },
  }
  for (const [key, child] of Object.entries(spec.sub ?? {})) {
    node.sub.set(
      key,
      prepare_node(
        child,
        [...path, key],
        params.flags,
        definitions,
        collector,
      ),
    )
  }
  const names = command_names(spec.sub)
  if (is_err(names)) {
    collector.submit(names.errors)
  } else {
    for (const [name, key] of names.value) {
      node.children.set(name, node.sub.get(key)!)
    }
  }
  mount_internal(node, definitions, collector)
  return node
}

/**
 * Prepares the complete application once, before any values or handlers
 * run.
 */
export function prepare(
  spec: App,
  definitions: readonly [_InternalCommand, ..._InternalCommand[]],
  collector: _Collector,
): _Node {
  const root = {
    ...spec.main,
    desc: spec.desc ?? spec.main?.desc,
    sub: spec.sub ?? spec.main?.sub,
  }
  return prepare_node(root, [], spec.flags ?? {}, definitions, collector)
}
