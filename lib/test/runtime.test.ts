import { describe, expect, it } from 'vitest'

import { create_collector } from '../src/collector'
import { args, check, cmd, flags, snippet } from '../src/helper'
import { create_context } from '../src/runtime'
import type { _Collector } from '../src/types'
import { memory_collector } from './shared'

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
    const memory = memory_collector()

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
      memory.collector,
    )

    expect(ctx.args).toEqual({ name: 'blog' })
    expect(ctx.flags).toEqual({ force: false, port: 2 })
    expect(ctx.unkArgs).toEqual(['extra'])
    expect(ctx.unkFlags).toEqual(['--unknown'])
    expect(memory.collector.has_errors()).toBe(true)
    expect(memory.descriptions()).toEqual(
      expect.arrayContaining([
        'Invalid argument value',
        'Unknown argument occurred',
        'Missing flag value',
        'Unknown flag occurred',
        'Repeated flag occurred',
      ]),
    )
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
    const missingMemory = memory_collector()

    const missingCtx = await create_context(
      { sub: { missing } },
      missing,
      ['node', 'craft', 'missing'],
      3,
      missingMemory.collector,
    )

    expect(missingCtx.args).toEqual({ kind: 'app' })
    expect(missingMemory.collector.has_errors()).toBe(true)
    expect(missingMemory.descriptions()).toContain('Missing required argument')

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
          owner: {
            resolver: String,
            check: check<string>(() => {
              throw 404
            }),
          },
        }),
      },
      () => {},
    )
    const auditMemory = memory_collector()

    const auditCtx = await create_context(
      { sub: { audit } },
      audit,
      ['node', 'craft', 'audit', 'abc123', 'Draft', 'team'],
      3,
      auditMemory.collector,
    )

    expect(auditCtx.args).toEqual({
      token: 'abc123',
      label: 'Draft',
      owner: 'team',
    })
    expect(auditMemory.collector.has_errors()).toBe(true)
    expect(auditMemory.text()).toContain('token expired')
    expect(auditMemory.text()).toContain('`label` did not pass its check')
    expect(auditMemory.text()).toContain('404')
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

  it('supports positional rest values and omitted optional flags', async () => {
    const archive = cmd(
      {
        args: args({
          files: { resolver: [String] },
        }),
        flags: flags({
          format: { required: false },
        }),
      },
      () => {},
    )
    const collector = quiet_collector()

    const ctx = await create_context(
      { sub: { archive } },
      archive,
      ['node', 'pack', 'archive', 'README.md', 'src/index.ts'],
      3,
      collector,
    )

    expect(ctx.args).toEqual({ files: ['README.md', 'src/index.ts'] })
    expect(ctx.flags).toEqual({})
    expect(collector.has_errors()).toBe(false)
  })

  it('supports custom resolvers and reports invalid boolean values', async () => {
    const as_date = (raw: string) => new Date(`${raw}T00:00:00.000Z`)
    const schedule = cmd(
      {
        args: args({
          when: {
            resolver: as_date,
          },
        }),
        flags: flags({
          published: { resolver: Boolean },
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      { sub: { schedule } },
      schedule,
      ['node', 'cms', 'schedule', '2026-06-09', '--published=maybe'],
      3,
      memory.collector,
    )

    expect(ctx.args.when).toEqual(new Date('2026-06-09T00:00:00.000Z'))
    expect(ctx.flags).toEqual({})
    expect(memory.collector.has_errors()).toBe(true)
    expect(memory.text()).toContain('not a valid boolean value')
  })

  it('reports non-Error resolver failures for arguments and flags', async () => {
    const fail_arg = (raw: string) => {
      throw `cannot read ${raw}`
    }
    const fail_flag = (raw: string) => {
      throw `bad mode ${raw}`
    }
    const convert = cmd(
      {
        args: args({
          input: { resolver: fail_arg },
        }),
        flags: flags({
          mode: { resolver: fail_flag },
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      { sub: { convert } },
      convert,
      ['node', 'asset', 'convert', 'design.fig', '--mode=fast'],
      3,
      memory.collector,
    )

    expect(ctx.args).toEqual({})
    expect(ctx.flags).toEqual({})
    expect(memory.descriptions()).toEqual([
      'Invalid argument value',
      'Invalid flag value',
    ])
    expect(memory.text()).toContain('`input` is invalid')
    expect(memory.text()).toContain('`--mode` is invalid')
  })

  it('covers defensive parser edges for aliases, terminal flag values, and malformed array resolvers', async () => {
    const send = cmd(
      {
        args: args({
          files: { resolver: [] as unknown as [StringConstructor] },
        }),
        flags: flags({
          force: { alias: ['f', 'force'], resolver: Boolean },
          output: {},
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      { sub: { send } },
      send,
      ['node', 'mail', 'send', 'letter.md', '-f', '--output'],
      3,
      memory.collector,
    )

    expect(ctx.args).toEqual({})
    expect(ctx.flags).toEqual({ force: true })
    expect(memory.descriptions()).toEqual([
      'Missing flag value',
      'Invalid argument value',
    ])
    expect(memory.text()).toContain('Array resolver must contain a resolver')
  })
})
