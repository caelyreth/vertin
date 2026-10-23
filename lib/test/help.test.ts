import { describe, expect, it } from 'bun:test'

import { args, cmd, flags, snippet } from '@/helper'

import { invoke_app } from './shared'

describe('generated help', () => {
  it.each(['--help', '-h'])(
    'shows schema-derived command help for %s',
    async (option) => {
      let evaluated = false
      const common = snippet({
        flags: flags({
          format: {
            choices: ['text', 'json'],
            fallback: 'text',
            desc: 'Output format',
          },
        }),
      })
      const deploy = cmd(
        {
          desc: 'Deploy a project',
          alias: 'd',
          use: [common],
          args: args({
            source: { desc: 'Project directory' },
            files: { resolver: [String], required: false },
          }),
          flags: flags({
            port: {
              alias: 'p',
              resolver: Number,
              fallback: 8080,
              desc: 'Listening port',
            },
            token: {
              required: true,
              resolver: (raw: string) => {
                evaluated = true
                return raw
              },
              check: () => {
                evaluated = true
              },
            },
          }),
        },
        () => {
          evaluated = true
        },
      )
      const result = await invoke_app(
        {
          flags: flags({ verbose: { alias: 'v', resolver: Boolean } }),
          sub: { deploy },
        },
        ['d', option],
      )
      expect(result.exitCode).toBe(0)
      expect(result.stderr).toBe('')
      expect(result.stdout).toContain(
        'Deploy a project\n\nUsage:\n  tool deploy [options] <source> [files...]',
      )
      expect(result.stdout).toContain('Project directory [required]')
      expect(result.stdout).toContain(
        '[choices: text, json] [default: text]',
      )
      expect(result.stdout).toContain('--port, -p <number>')
      expect(result.stdout).toContain('[default: 8080]')
      expect(result.stdout).toContain('--help, -h')
      expect(result.stdout).toContain('--verbose, -v')
      expect(evaluated).toBe(false)
    },
  )

  it.each([
    { argv: ['help', 'r', 'a'] },
    { argv: ['r', 'help', 'a'] },
    { argv: ['--help', 'r', 'a'] },
  ])(
    'resolves help paths using canonical commands and aliases: %j',
    async ({ argv }) => {
      const add = cmd(
        { desc: 'Add remote', alias: 'a', args: args({ name: {} }) },
        () => {},
      )
      const remote = cmd({
        alias: 'r',
        flags: flags({ cwd: { fallback: '.' } }),
        sub: { add },
      })
      const result = await invoke_app({ sub: { remote } }, argv)
      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('tool remote add [options] <name>')
      expect(result.stdout).toContain('--cwd <string>')
    },
  )

  it('supports root help and lists commands once with their aliases', async () => {
    const result = await invoke_app(
      {
        desc: 'Tools',
        sub: {
          build: cmd(
            { alias: ['b', 'compile'], desc: 'Build project' },
            () => {},
          ),
        },
      },
      ['--help'],
    )
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('build (b, compile)')
    expect(result.stdout.match(/Build project/g)).toHaveLength(1)
  })

  it('does not treat values or tokens after -- as help requests', async () => {
    let received: unknown
    const main = cmd(
      { args: args({ value: {} }), flags: flags({ label: {} }) },
      (ctx) => {
        received = ctx
      },
    )
    const result = await invoke_app({ main }, [
      '--label=--help',
      '--',
      '--help',
    ])
    expect(result.stdout).toBe('')
    expect(result.exitCode).toBe(0)
    expect(received).toMatchObject({
      args: { value: '--help' },
      flags: { label: '--help' },
    })
  })

  it('bypasses invalid values and checks for an explicit help request', async () => {
    const main = cmd(
      {
        flags: flags({ port: { resolver: Number } }),
        args: args({ name: {} }),
      },
      () => {
        throw new Error('must not run')
      },
    )
    const result = await invoke_app({ main }, ['--port=many', '--help'])
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toContain('Usage:')
  })

  it('does not hide schema collisions behind help', async () => {
    const main = cmd({ flags: flags({ host: { alias: 'h' } }) }, () => {})
    const result = await invoke_app({ main }, ['--help'])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Invalid flag schema')
    const reserved = await invoke_app(
      { sub: { help: cmd({}, () => {}) } },
      ['help'],
    )
    expect(reserved.stderr).toContain('reserved')
  })

  it('allows applications to reclaim help names explicitly', async () => {
    let handled = false
    const help = cmd(
      { flags: flags({ help: { alias: 'h', resolver: Boolean } }) },
      () => {
        handled = true
      },
    )
    const result = await invoke_app(
      { config: { help: false }, sub: { help } },
      ['help', '-h'],
    )
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(handled).toBe(true)
  })
})
