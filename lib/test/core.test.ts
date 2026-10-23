import { describe, expect, it } from 'bun:test'

import { create_scope } from '@/core'
import { cmd, flags } from '@/helper'
import { internal_commands } from '@/internal'
import { prepare } from '@/schema'

import { invoke_app, memory_collector } from './shared'

describe('command scopes', () => {
  it('exposes prepared schema metadata and relative lookup under ctx._', async () => {
    let observed = false
    const leaf = cmd({ alias: 'l', desc: 'Leaf action' }, (ctx) => {
      expect(ctx._.path).toEqual(['group', 'leaf'])
      expect(ctx._.cmd.desc).toBe('Leaf action')
      expect(ctx._.flags).toHaveProperty('verbose')
      expect(ctx._.flags).toHaveProperty('help')
      expect(ctx._.name).toBe('tool')
      observed = true
    })
    const spec = {
      flags: flags({ verbose: { resolver: Boolean } }),
      sub: { group: cmd({ alias: 'g', sub: { leaf } }) },
    }
    const result = await invoke_app(spec, ['g', 'l'])
    expect(result.exitCode).toBe(0)
    expect(observed).toBe(true)
  })

  it('mounts help as an ordinary internal command in group scopes', () => {
    const leaf = cmd({}, () => {})
    const spec = { sub: { leaf } }
    const memory = memory_collector()
    const root = prepare(spec, internal_commands(spec), memory.collector)
    const scope = create_scope(spec, root, 'tool', memory.collector)
    expect(scope.sub.help?.handler).toBeDefined()
    const help = scope.resolve(['help'])
    expect(help.success).toBe(true)
    if (help.success) {
      expect(help.value.cmd.desc).toBe('Show help for a command')
      expect(help.value.args).toHaveProperty('command')
    }
    const selected = scope.resolve(['leaf'])
    expect(selected.success).toBe(true)
    if (selected.success) expect(selected.value.cmd).toBe(leaf)
  })

  it('returns structured errors for unknown or inherited-property names', () => {
    const spec = { sub: { deploy: cmd({}, () => {}) } }
    const memory = memory_collector()
    const root = prepare(spec, internal_commands(spec), memory.collector)
    const scope = create_scope(spec, root, 'tool', memory.collector)
    for (const name of ['deply', 'toString']) {
      const result = scope.resolve([name])
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.desc).toBe('Invalid command occurred')
      }
    }
  })

  it('validates all command scopes before any handler can run', async () => {
    let handled = false
    const spec = {
      sub: {
        safe: cmd({}, () => {
          handled = true
        }),
        broken: cmd({ sub: { one: cmd({ alias: 'two' }), two: cmd({}) } }),
      },
    }
    const result = await invoke_app(spec, ['safe'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Invalid command schema')
    expect(handled).toBe(false)
  })
})
