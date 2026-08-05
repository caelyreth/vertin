import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app, args, check, cmd, flags, snippet } from '@/index'

import { capture_stderr, type _CapturedStderr } from './shared'

let originalArgv: string[]
let originalExitCode: typeof process.exitCode
let stderr: _CapturedStderr

beforeEach(() => {
  originalArgv = process.argv
  originalExitCode = process.exitCode
  process.exitCode = undefined
  stderr = capture_stderr()
})

afterEach(() => {
  process.argv = originalArgv
  process.exitCode = originalExitCode
  stderr.restore()
})

describe('public app runner', () => {
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

    process.argv = [
      '/usr/local/bin/node',
      '/repo/bin/release.ts',
      'publish',
      '@acme/web',
      '--tag=next',
      '--channel',
      'canary',
      '--channel=stable',
      '-y',
      '--dry-run=false',
    ]

    await cli.run()

    expect(process.exitCode).toBeUndefined()
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

    process.argv = [
      'node',
      'craft',
      'make',
      'My App',
      '--count',
      'many',
      '--extra',
    ]

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

    process.argv = ['node', 'web', 'serve', '--no-cache']

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

  it('reports command matching and handler failures through internal diagnostics', async () => {
    process.argv = ['node', 'craft', 'missing']

    await app({}).run()

    expect(process.exitCode).toBe(1)
    expect(stderr.text()).toContain('Invalid command occurred')

    stderr.chunks.length = 0
    process.exitCode = undefined
    process.argv = ['node', 'craft', 'explode']

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
    process.argv = ['node', 'craft', 'explode']

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
