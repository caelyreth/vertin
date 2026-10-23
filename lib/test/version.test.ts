import { describe, expect, it } from 'bun:test'

import { args, cmd, flags } from '@/helper'

import { invoke_app } from './shared'

describe('automatic version', () => {
  it.each(['--version', '-V'])(
    'prints only the version for %s',
    async (option) => {
      let evaluated = false
      const main = cmd(
        {
          args: args({
            name: {
              check: () => {
                evaluated = true
              },
            },
          }),
          flags: flags({ verbose: { alias: 'v', resolver: Boolean } }),
        },
        () => {
          evaluated = true
        },
      )
      const result = await invoke_app({ ver: '1.2.3', main }, [option])
      expect(result).toEqual({ stdout: '1.2.3\n', stderr: '', exitCode: 0 })
      expect(evaluated).toBe(false)
    },
  )

  it('works at the root or inside nested command scopes', async () => {
    const deploy = cmd({ args: args({ name: {} }) }, () => {
      throw new Error('must not run')
    })
    const spec = { ver: '2.0.0', sub: { remote: cmd({ sub: { deploy } }) } }
    expect(await invoke_app(spec, ['--version'])).toEqual({
      stdout: '2.0.0\n',
      stderr: '',
      exitCode: 0,
    })
    expect(await invoke_app(spec, ['remote', 'deploy', '-V'])).toEqual({
      stdout: '2.0.0\n',
      stderr: '',
      exitCode: 0,
    })
    const help = await invoke_app(spec, ['remote', 'deploy', '--help'])
    expect(help.stdout).toContain('--version, -V')
  })

  it('does not reserve version flags without metadata or when disabled', async () => {
    let received: unknown
    const main = cmd(
      { flags: flags({ version: { alias: 'V' } }) },
      (ctx) => {
        received = ctx.flags.version
      },
    )
    expect(
      (await invoke_app({ main }, ['--version=custom'])).exitCode,
    ).toBe(0)
    expect(received).toBe('custom')
    expect(
      (
        await invoke_app({ main, ver: '1', config: { version: false } }, [
          '-V',
          'custom',
        ])
      ).exitCode,
    ).toBe(0)
    const missing = await invoke_app({}, ['--version'])
    expect(missing.exitCode).toBe(1)
    expect(missing.stderr).toContain('Unknown flag occurred')
  })

  it('respects literal values, --, false values, and help precedence', async () => {
    let received: unknown
    const main = cmd(
      { args: args({ value: {} }), flags: flags({ label: {} }) },
      (ctx) => {
        received = ctx
      },
    )
    const spec = { ver: '3', main }
    const literal = await invoke_app(spec, [
      '--label=--version',
      '--',
      '--version',
    ])
    expect(literal.stdout).toBe('')
    expect(received).toMatchObject({
      args: { value: '--version' },
      flags: { label: '--version' },
    })
    const disabled = await invoke_app(spec, ['--version=false'])
    expect(disabled.stderr).toContain('Missing required argument')
    const help = await invoke_app(spec, ['--help', '--version'])
    expect(help.stdout).toContain('Usage:')
    expect(help.stdout).not.toBe('3\n')
  })

  it('validates reserved version names before displaying output', async () => {
    const main = cmd(
      { flags: flags({ verbose: { alias: 'V', resolver: Boolean } }) },
      () => {},
    )
    const result = await invoke_app({ ver: '1', main }, ['--version'])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Invalid flag schema')
  })
})
