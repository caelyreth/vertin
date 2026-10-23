import { describe, expect, it } from 'bun:test'

import { app, args, cmd, flags, snippet } from '@/helper'

import { invoke_app } from './shared'

describe('flag scopes', () => {
  it.each([
    { argv: ['--verbose', 'remote', '--cwd', '/repo', 'add', 'origin'] },
    { argv: ['remote', 'add', '--verbose', 'origin', '--cwd=/repo'] },
    { argv: ['remote', '--verbose', 'add', '--cwd', '/repo', 'origin'] },
  ])(
    'accepts inherited flags around command boundaries: %j',
    async ({ argv }) => {
      let received: unknown
      const common = snippet({
        flags: flags({
          verbose: { alias: 'v', resolver: Boolean, fallback: false },
        }),
      })
      const directory = snippet({
        flags: flags({ cwd: { alias: 'C', fallback: '.' } }),
      })
      const add = cmd(
        { use: [common, directory], args: args({ name: {} }) },
        (ctx) => {
          const verbose: boolean = ctx.flags.verbose
          received = { name: ctx.args.name, verbose, cwd: ctx.flags.cwd }
        },
      )
      const remote = cmd(
        {
          use: [directory],
          sub: { add },
        },
        () => {},
      )
      const cli = app({ flags: common.flags, sub: { remote } })
      const result = await invoke_app(cli, argv)
      expect(result).toEqual({ stdout: '', stderr: '', exitCode: 0 })
      expect(received).toEqual({
        name: 'origin',
        verbose: true,
        cwd: '/repo',
      })
    },
  )

  it('does not inherit positional arguments or execute parent handlers', async () => {
    let parent = false
    let child = false
    const leaf = cmd({}, () => {
      child = true
    })
    const group = cmd({ args: args({ unused: {} }), sub: { leaf } }, () => {
      parent = true
    })
    const result = await invoke_app({ sub: { group } }, ['group', 'leaf'])
    expect(result.exitCode).toBe(0)
    expect(child).toBe(true)
    expect(parent).toBe(false)
  })

  it('keeps array values within the command boundary', async () => {
    let received: unknown
    const leaf = cmd(
      { args: args({ optional: { required: false } }) },
      (ctx) => {
        received = ctx
      },
    )
    const result = await invoke_app(
      {
        flags: flags({ include: { resolver: [String] } }),
        sub: { leaf },
      },
      ['--include', 'a', 'b', 'leaf', 'target'],
    )
    expect(result.exitCode).toBe(0)
    expect(received).toMatchObject({
      args: { optional: 'target' },
      flags: { include: ['a', 'b'] },
    })
  })

  it('uses the same resolver, choices, checks and requiredness for global flags', async () => {
    let handled = false
    const leaf = cmd({}, () => {
      handled = true
    })
    const spec = {
      flags: flags({
        port: {
          resolver: Number,
          required: true,
          choices: [80, 443],
          check: ({ value }) => value === 443 || 'TLS required',
        },
      }),
      sub: { leaf },
    }
    expect((await invoke_app(spec, ['--port=443', 'leaf'])).exitCode).toBe(
      0,
    )
    handled = false
    const bad = await invoke_app(spec, ['leaf', '--port=80'])
    expect(bad.stderr).toContain('TLS required')
    expect(handled).toBe(false)
    expect((await invoke_app(spec, ['leaf'])).stderr).toContain(
      'Missing required flag',
    )
  })

  it('rejects key shadowing, alias collisions and repeated scalar occurrences', async () => {
    const global = flags({ verbose: { alias: 'v', resolver: Boolean } })
    const shadow = cmd(
      { flags: flags({ verbose: { resolver: String } }) },
      () => {},
    )
    expect(
      (await invoke_app({ flags: global, sub: { shadow } }, ['shadow']))
        .stderr,
    ).toContain('parent scope')
    const alias = cmd(
      { flags: flags({ version: { alias: 'v', resolver: Boolean } }) },
      () => {},
    )
    expect(
      (await invoke_app({ flags: global, sub: { alias } }, ['alias']))
        .stderr,
    ).toContain('already used')
    const leaf = cmd({}, () => {})
    expect(
      (
        await invoke_app({ flags: global, sub: { leaf } }, [
          '-v',
          'leaf',
          '-v',
        ])
      ).stderr,
    ).toContain('Repeated flag occurred')
  })

  it('retains original token offsets and honors the terminator', async () => {
    const leaf = cmd({ args: args({ literal: {} }) }, () => {})
    const spec = {
      flags: flags({ port: { resolver: Number } }),
      sub: { leaf },
    }
    const bad = await invoke_app(spec, ['--port=many', 'leaf', 'target'])
    expect(bad.stderr).toContain('> bun tool --port=many leaf target')
    expect(bad.stderr).toContain('           ^^^^^^^^^^^')
    const good = await invoke_app(spec, ['leaf', '--', '--port'])
    expect(good.exitCode).toBe(0)
  })
})
