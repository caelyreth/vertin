import { describe, expect, it } from 'vitest'

import { create_collector } from '../src/collector'
import { args, check, cmd, flags, snippet } from '../src/helper'
import { create_context } from '../src/runtime'
import type { _Collector } from '../src/types'

function quiet_collector(): _Collector {
  const collector = create_collector()
  collector.log = collector.submit
  collector.collect = () => {}
  return collector
}

describe('runtime context construction', () => {
  it('merges snippets, resolves primitives and arrays, applies fallbacks, and runs async checks', async () => {
    const seen: number[] = []
    const shared = snippet({
      flags: flags({
        cwd: { alias: 'C', fallback: '/repo' },
        verbose: { alias: 'v', resolver: Boolean, fallback: false },
      }),
    })
    const deploy = cmd(
      {
        use: [shared],
        args: args({
          environment: {
            resolver: String,
            check: check<string>(
              async ({ value }) => value !== 'prod' || 'locked',
            ),
          },
          revision: { resolver: Number },
        }),
        flags: flags({
          include: { alias: 'i', resolver: [String], fallback: [] as string[] },
          retries: {
            resolver: Number,
            fallback: 1,
            check: check<number>(({ value }) => {
              seen.push(value)
            }),
          },
        }),
      },
      () => {},
    )
    const collector = quiet_collector()

    const ctx = await create_context(
      { sub: { deploy } },
      deploy,
      [
        'node',
        'release',
        'deploy',
        'staging',
        '102',
        '-v',
        '-i',
        'api',
        '--include=worker',
        '--retries',
        '3',
      ],
      3,
      collector,
    )

    expect(ctx.args).toEqual({ environment: 'staging', revision: 102 })
    expect(ctx.flags).toEqual({
      cwd: '/repo',
      verbose: true,
      include: ['api', 'worker'],
      retries: 3,
    })
    expect(ctx.unkArgs).toEqual([])
    expect(ctx.unkFlags).toEqual([])
    expect(seen).toEqual([3])
    expect(collector.has_errors()).toBe(false)
  })

  it('collects unknown tokens, missing required values, resolver failures, repeated scalar flags, and check failures', async () => {
    const create = cmd(
      {
        args: args({
          name: {},
          count: { resolver: Number },
        }),
        flags: flags({
          force: { resolver: Boolean },
          output: { alias: 'o', required: true },
          port: {
            resolver: Number,
            check: check<number>(
              ({ value }) => value > 0 || 'port must be positive',
            ),
          },
        }),
      },
      () => {},
    )
    const collector = quiet_collector()

    const ctx = await create_context(
      { sub: { create } },
      create,
      [
        'node',
        'scaffold',
        'create',
        'blog',
        'NaN',
        'extra',
        '--force=false',
        '--output',
        '--unknown',
        '--port',
        '-1',
        '--port=2',
      ],
      3,
      collector,
    )

    expect(ctx.args).toEqual({ name: 'blog' })
    expect(ctx.flags).toEqual({ force: false, port: 2 })
    expect(ctx.unkArgs).toEqual(['extra'])
    expect(ctx.unkFlags).toEqual(['--unknown'])
    expect(collector.has_errors()).toBe(true)
  })

  it('handles missing positional arguments, optional omissions, fallbacks, and failed checks', async () => {
    const missing = cmd(
      {
        args: args({
          name: {},
          profile: { required: false },
          kind: { fallback: 'app' },
        }),
      },
      () => {},
    )
    const missingCollector = quiet_collector()

    const missingCtx = await create_context(
      { sub: { missing } },
      missing,
      ['node', 'craft', 'missing'],
      3,
      missingCollector,
    )

    expect(missingCtx.args).toEqual({ kind: 'app' })
    expect(missingCollector.has_errors()).toBe(true)

    const audit = cmd(
      {
        args: args({
          token: {
            resolver: String,
            check: check<string>(() => {
              throw new Error('token expired')
            }),
          },
          label: {
            resolver: String,
            check: check<string>(() => false),
          },
        }),
      },
      () => {},
    )
    const auditCollector = quiet_collector()

    const auditCtx = await create_context(
      { sub: { audit } },
      audit,
      ['node', 'craft', 'audit', 'abc123', 'Draft'],
      3,
      auditCollector,
    )

    expect(auditCtx.args).toEqual({ token: 'abc123', label: 'Draft' })
    expect(auditCollector.has_errors()).toBe(true)
  })

  it('allows negative number flag values and positional values after the terminator', async () => {
    const meter = cmd(
      {
        args: args({
          delta: { resolver: Number },
        }),
        flags: flags({
          threshold: { resolver: Number },
        }),
      },
      () => {},
    )
    const collector = quiet_collector()

    const ctx = await create_context(
      { sub: { meter } },
      meter,
      ['node', 'meter', 'meter', '--threshold', '-10', '--', '-2'],
      3,
      collector,
    )

    expect(ctx.args).toEqual({ delta: -2 })
    expect(ctx.flags).toEqual({ threshold: -10 })
    expect(collector.has_errors()).toBe(false)
  })
})
