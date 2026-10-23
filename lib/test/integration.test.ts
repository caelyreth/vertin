import { afterEach, beforeEach, describe, expect, it } from 'bun:test'

import { app, args, check, cmd, flags, snippet } from '@/index'

import { capture_stderr, set_argv, type _CapturedOutput } from './shared'

let originalArgv: string[]
let originalExitCode: typeof process.exitCode
let stderr: _CapturedOutput

beforeEach(() => {
  originalArgv = [...Bun.argv]
  originalExitCode = process.exitCode
  process.exitCode = 0
  stderr = capture_stderr()
})

afterEach(() => {
  set_argv(originalArgv)
  process.exitCode = originalExitCode ?? 0
  stderr.restore()
})

describe('public app runner', () => {
  it.each([
    ['/usr/local/bin/bun', '/repo/bin/tool.ts'],
    ['C:\\tools\\bun', 'C:\\repo\\bin\\tool.ts'],
  ])(
    'shows basenames in diagnostics for %s and %s',
    async (exe, script) => {
      set_argv([exe, script, 'missing'])

      await app({}).run()

      expect(process.exitCode).toBe(1)
      expect(stderr.text()).toContain('> bun tool.ts missing')
    },
  )
  it('runs a real project workflow with typed args, flags, snippets, and app-local run()', async () => {
    const received: unknown[] = []
    const workspace = snippet({
      flags: flags({
        cwd: { alias: 'C', fallback: process.cwd() },
        dryRun: { alias: 'dry-run', resolver: Boolean, fallback: false },
      }),
    })
    const publish = cmd(
      {
        use: [workspace],
        args: args({
          packageName: {
            resolver: String,
            check: check<string>(({ value }) => value.startsWith('@acme/')),
          },
        }),
        flags: flags({
          tag: { fallback: 'latest' },
          channel: { resolver: [String], fallback: [] },
          yes: { alias: 'y', resolver: Boolean, fallback: false },
        }),
      },
      (ctx) => {
        received.push(ctx)
      },
    )
    const cli = app({
      desc: 'Release helper',
      sub: { publish },
    })

    set_argv([
      '/usr/local/bin/bun',
      '/repo/bin/release.ts',
      'publish',
      '@acme/web',
      '--tag=next',
      '--channel',
      'canary',
      '--channel=stable',
      '-y',
      '--dry-run=false',
    ])

    await cli.run()

    expect(process.exitCode).toBe(0)
    expect(stderr.text()).toBe('')
    expect(received).toHaveLength(1)
    expect(received[0]).toMatchObject({
      args: { packageName: '@acme/web' },
      flags: {
        cwd: process.cwd(),
        dryRun: false,
        tag: 'next',
        channel: ['canary', 'stable'],
        yes: true,
      },
      unkArgs: [],
      unkFlags: [],
    })
  })

  it('stops before handler when parsing or checks produce diagnostics', async () => {
    let handled = false
    const make = cmd(
      {
        args: args({
          name: {
            resolver: String,
            check: check<string>(
              ({ value }) =>
                /^[a-z][a-z0-9-]*$/.test(value) || 'use kebab-case',
            ),
          },
        }),
        flags: flags({
          count: { resolver: Number, required: true },
        }),
      },
      () => {
        handled = true
      },
    )

    set_argv([
      'bun',
      'craft',
      'make',
      'My App',
      '--count',
      'many',
      '--extra',
    ])

    await app({ sub: { make } }).run()

    expect(handled).toBe(false)
    expect(process.exitCode).toBe(1)
    expect(stderr.text()).toContain('Invalid flag value')
    expect(stderr.text()).toContain('Unknown flag occurred')
    expect(stderr.text()).toContain('Check failed')
  })

  it('honors parser tweaks from public app config', async () => {
    let handled = false
    const serve = cmd(
      {
        flags: flags({
          cache: { resolver: Boolean, fallback: true },
        }),
      },
      () => {
        handled = true
      },
    )

    set_argv(['bun', 'web', 'serve', '--no-cache'])

    await app(
      {
        sub: { serve },
      },
      {
        tweaks: {
          booleanNegation: false,
        },
      },
    ).run()

    expect(handled).toBe(false)
    expect(process.exitCode).toBe(1)
    expect(stderr.text()).toContain('Unknown flag occurred')
  })

  it('reports command matching failures through internal diagnostics', async () => {
    set_argv(['bun', 'craft', 'missing'])

    await app({}).run()

    expect(process.exitCode).toBe(1)
    expect(stderr.text()).toContain('Invalid command occurred')
  })

  it('reports handler failures through internal diagnostics', async () => {
    set_argv(['bun', 'craft', 'explode'])

    await app({
      sub: {
        explode: cmd({}, () => {
          throw new Error('database unavailable')
        }),
      },
    }).run()

    expect(process.exitCode).toBe(1)
    expect(stderr.text()).toContain('Handler failed')
    expect(stderr.text()).toContain('database unavailable')
  })

  it('reports non-Error handler failures without losing exit semantics', async () => {
    set_argv(['bun', 'craft', 'explode'])

    await app({
      sub: {
        explode: cmd({}, () => {
          throw 'permission denied'
        }),
      },
    }).run()

    expect(process.exitCode).toBe(1)
    expect(stderr.text()).toContain('Handler failed')
    expect(stderr.text()).toContain('permission denied')
  })
})
