import { describe, expect, it } from 'bun:test'

import { create_scope } from '@/core'
import { cmd } from '@/helper'
import { internal_commands } from '@/internal'
import { command_names, prepare } from '@/schema'
import { ok } from '@/utils'

import { invoke_app, memory_collector } from './shared'

describe('command aliases', () => {
  const commit = cmd({ alias: ['ci', 'save'] }, () => {})
  const remote = cmd({ alias: 'r', sub: { commit } }, () => {})

  it('resolves canonical and alternative names to one prepared command', () => {
    const spec = { sub: { remote } }
    const memory = memory_collector()
    const scope = create_scope(
      spec,
      prepare(spec, internal_commands(spec), memory.collector),
      'tool',
      memory.collector,
    )
    for (const name of ['commit', 'ci', 'save']) {
      const result = scope.resolve(['r', name])
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.value.cmd).toBe(commit)
        expect(result.value.path).toEqual(['remote', 'commit'])
      }
    }
    expect(command_names({ remote })).toEqual(
      ok(
        new Map([
          ['remote', 'remote'],
          ['r', 'remote'],
        ]),
      ),
    )
  })

  it.each([
    { one: cmd({ alias: 'two' }), two: cmd({}) },
    { one: cmd({ alias: 'x' }), two: cmd({ alias: 'x' }) },
  ])('rejects alias collisions in a scope', async (sub) => {
    const result = await invoke_app({ sub }, ['one'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Invalid command schema')
    expect(result.stderr).toContain('already used')
  })

  it.each(['', '-bad', 'two words'])(
    'rejects malformed canonical name %s before dispatch',
    async (name) => {
      const result = await invoke_app({ sub: { [name]: cmd({}) } }, [
        '--help',
      ])
      expect(result.exitCode).toBe(1)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('Invalid command schema')
    },
  )

  it.each(['', '-bad', 'two words'])(
    'rejects malformed alias %s',
    (alias) => {
      expect(command_names({ remote: cmd({ alias }) }).success).toBe(false)
    },
  )
})
