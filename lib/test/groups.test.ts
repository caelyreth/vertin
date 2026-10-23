import { describe, expect, it } from 'bun:test'

import { args, cmd, flags } from '@/helper'

import { invoke_app } from './shared'

describe('command groups', () => {
  it('shows root usage and children instead of a missing-command warning', async () => {
    const result = await invoke_app(
      {
        desc: 'Project tools',
        sub: {
          build: cmd({ desc: 'Build project', alias: 'b' }, () => {}),
        },
      },
      [],
    )
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain(
      'Project tools\n\nUsage:\n  tool <command>',
    )
    expect(result.stdout).toContain('build (b)')
    expect(result.stdout).toContain('Build project')
  })

  it('shows nested group usage without checking required inputs', async () => {
    let checked = false
    const add = cmd({}, () => {})
    const remote = cmd({
      desc: 'Manage remotes',
      alias: 'r',
      sub: { add },
      flags: flags({
        token: {
          required: true,
          check: () => {
            checked = true
          },
        },
      }),
      args: args({ unused: {} }),
    })
    const result = await invoke_app({ sub: { remote } }, ['r'])
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('tool remote <command> [options]')
    expect(result.stdout).toContain('--token <string>')
    expect(checked).toBe(false)
  })

  it('still dispatches children and preserves optional parent actions', async () => {
    const seen: string[] = []
    const leaf = cmd({}, () => {
      seen.push('leaf')
    })
    const group = cmd({ sub: { leaf } })
    const action = cmd({ sub: { leaf } }, () => {
      seen.push('action')
    })
    await invoke_app({ sub: { group, action } }, ['group', 'leaf'])
    await invoke_app({ sub: { group, action } }, ['action'])
    await invoke_app({ sub: { group, action } }, ['action', 'leaf'])
    expect(seen).toEqual(['leaf', 'action', 'leaf'])
  })

  it('rejects unknown children and invalid flags instead of hiding them', async () => {
    const remote = cmd({ sub: { add: cmd({}, () => {}) } })
    const bad = await invoke_app({ sub: { remote } }, ['remote', 'missing'])
    expect(bad.exitCode).toBe(1)
    expect(bad.stdout).toBe('')
    expect(bad.stderr).toContain('Invalid command occurred')
    const unknown = await invoke_app({ sub: { remote } }, [
      'remote',
      '--unknown',
    ])
    expect(unknown.exitCode).toBe(1)
    expect(unknown.stdout).toBe('')
    expect(unknown.stderr).toContain('Unknown flag occurred')
  })
})
