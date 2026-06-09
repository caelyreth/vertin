import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { app, args, check, cmd, flags, snippet } from '../src'

let originalArgv: string[]
let originalExitCode: typeof process.exitCode
let originalStderrWrite: typeof process.stderr.write
let stderr: string[]

beforeEach(() => {
  originalArgv = process.argv
  originalExitCode = process.exitCode
  originalStderrWrite = process.stderr.write
  stderr = []
  process.exitCode = undefined
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr.push(String(chunk))
    return true
  }) as typeof process.stderr.write
})

afterEach(() => {
  process.argv = originalArgv
  process.exitCode = originalExitCode
  process.stderr.write = originalStderrWrite
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
    expect(stderr.join('')).toBe('')
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
    expect(stderr.join('')).toContain('Invalid flag value')
    expect(stderr.join('')).toContain('Unknown flag occurred')
    expect(stderr.join('')).toContain('Check failed')
  })

  it('reports command matching and handler failures through internal diagnostics', async () => {
    process.argv = ['node', 'craft', 'missing']

    await app({}).run()

    expect(process.exitCode).toBe(1)
    expect(stderr.join('')).toContain('Invalid command occurred')

    stderr = []
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
    expect(stderr.join('')).toContain('Handler failed')
    expect(stderr.join('')).toContain('database unavailable')
  })
})
