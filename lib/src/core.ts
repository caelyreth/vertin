/**
 * @license MIT
 * @file Internal context scopes and relative command lookup.
 * @author Yu <me@iki.moe>
 * @copyright Yu 2026
 */

import { invalid_command } from './errors'
import type { _Node } from './schema'
import type {
  _Collector,
  _ContextScope,
  _Message,
  _Result,
  App,
} from './types'
import { err, is_err, ok } from './utils'

function resolve_node(
  node: _Node,
  path: readonly string[],
  name: string,
): _Result<_Node, _Message> {
  let current = node
  for (const [index, token] of path.entries()) {
    const child = current.children.get(token)
    if (!child) {
      const source = [name, ...node.path, ...path]
      return err(
        invalid_command(
          source,
          1 + node.path.length + index,
          token,
          current.children.keys(),
        ),
      )
    }
    current = child
  }
  return ok(current)
}

/**
 * Internal commands inspect the same prepared scope that the parser uses.
 */
export function create_scope(
  app: App,
  node: _Node,
  name: string,
  collector: _Collector,
): _ContextScope {
  return {
    app,
    cmd: node.spec,
    name,
    path: node.path,
    args: node.params.args,
    flags: node.flags,
    sub: Object.fromEntries(
      [...node.sub].map(([key, child]) => [key, child.spec]),
    ),
    collector,
    resolve: (path) => {
      const resolved = resolve_node(node, path, name)
      return is_err(resolved)
        ? resolved
        : ok(create_scope(app, resolved.value, name, collector))
    },
  }
}
