import { describe, expect, it } from 'bun:test'

import { command_names, match } from '@/core'
import { cmd } from '@/helper'
import { ok } from '@/utils'

describe('command aliases', () => {
  const commit = cmd({ alias: ['ci', 'save'] }, () => {})
  const remote = cmd({ alias: 'r', sub: { commit } }, () => {})

  it('matches canonical and alternative names at each level', () => {
    for (const name of ['commit', 'ci', 'save']) {
      expect(
        match({ sub: { remote } }, ['bun', 'tool', 'r', name, 'file']),
      ).toMatchObject({
        success: true,
        value: { cmd: commit, offset: 4, path: ['remote', 'commit'] },
      })
    }
    const names = command_names({ remote })
    expect(names).toEqual(
      ok(
        new Map([
          ['remote', 'remote'],
          ['r', 'remote'],
        ]),
      ),
    )
  })

  it('rejects alias collisions with canonical names or other aliases', () => {
    for (const sub of [
      { one: cmd({ alias: 'two' }, () => {}), two: cmd({}, () => {}) },
      {
        one: cmd({ alias: 'x' }, () => {}),
        two: cmd({ alias: 'x' }, () => {}),
      },
    ]) {
      const result = match({ sub }, ['bun', 'tool', 'one'])
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.errors.desc).toBe('Invalid command schema')
        expect(result.errors.diag?.markup).toContain('already used')
      }
    }
  })

  it.each(['', '-bad', 'two words'])(
    'rejects malformed alias %s',
    (alias) => {
      const result = command_names({ remote: cmd({ alias }, () => {}) })
      expect(result.success).toBe(false)
    },
  )

  it('does not resolve inherited object properties as commands', () => {
    expect(
      match({ sub: { remote } }, ['bun', 'tool', 'toString']).success,
    ).toBe(false)
  })
})
