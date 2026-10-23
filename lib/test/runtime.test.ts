import { describe, expect, it } from 'bun:test'

import { create_collector } from '@/collector'
import { args, check, cmd, flags, snippet } from '@/helper'
import { create_context } from '@/runtime'
import type { _Collector } from '@/types'

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
          include: {
            alias: 'i',
            resolver: [String],
            fallback: [] as string[],
          },
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
        'bun',
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
        'bun',
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
    for (const desc of [
      'Invalid argument value',
      'Unknown argument occurred',
      'Missing flag value',
      'Unknown flag occurred',
      'Repeated flag occurred',
    ]) {
      expect(memory.descriptions()).toContain(desc)
    }
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
      ['bun', 'craft', 'missing'],
      3,
      missingMemory.collector,
    )

    expect(missingCtx.args).toEqual({ kind: 'app' })
    expect(missingMemory.collector.has_errors()).toBe(true)
    expect(missingMemory.descriptions()).toContain(
      'Missing required argument',
    )

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
      ['bun', 'craft', 'audit', 'abc123', 'Draft', 'team'],
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
      ['bun', 'meter', 'meter', '--threshold', '-10', '--', '-2'],
      3,
      collector,
    )

    expect(ctx.args).toEqual({ delta: -2 })
    expect(ctx.flags).toEqual({ threshold: -10 })
    expect(collector.has_errors()).toBe(false)
  })

  it('supports boolean negation and rejects invalid negation forms', async () => {
    const serve = cmd(
      {
        flags: flags({
          cache: { resolver: Boolean, fallback: true },
          output: { fallback: 'dist' },
        }),
      },
      () => {},
    )
    const collector = quiet_collector()

    const ctx = await create_context(
      { sub: { serve } },
      serve,
      ['bun', 'web', 'serve', '--no-cache'],
      3,
      collector,
    )

    expect(ctx.flags).toEqual({ cache: false, output: 'dist' })
    expect(collector.has_errors()).toBe(false)

    const memory = memory_collector()
    const edgeCtx = await create_context(
      { sub: { serve } },
      serve,
      ['bun', 'web', 'serve', '--no-output', '--no-cache=true'],
      3,
      memory.collector,
    )

    expect(edgeCtx.flags).toEqual({ cache: true, output: 'dist' })
    expect(edgeCtx.unkFlags).toEqual(['--no-output', '--no-cache=true'])
    expect(memory.descriptions()).toEqual([
      'Unknown flag occurred',
      'Unknown flag occurred',
    ])

    const partialConfig = quiet_collector()
    const partialCtx = await create_context(
      {
        config: {
          tweaks: {
            negativeNumberValues: false,
          },
        },
        sub: { serve },
      },
      serve,
      ['bun', 'web', 'serve', '--no-cache'],
      3,
      partialConfig,
    )

    expect(partialCtx.flags).toEqual({ cache: false, output: 'dist' })
    expect(partialConfig.has_errors()).toBe(false)
  })

  it('supports short boolean clusters and rejects ambiguous clusters', async () => {
    const list = cmd(
      {
        flags: flags({
          all: { alias: 'a', resolver: Boolean, fallback: false },
          long: { alias: 'l', resolver: Boolean, fallback: false },
          human: { alias: 'h', resolver: Boolean, fallback: false },
          output: { alias: 'o', fallback: 'stdout' },
        }),
      },
      () => {},
    )
    const collector = quiet_collector()

    const ctx = await create_context(
      { sub: { list } },
      list,
      ['bun', 'fs', 'list', '-alh'],
      3,
      collector,
    )

    expect(ctx.flags).toEqual({
      all: true,
      long: true,
      human: true,
      output: 'stdout',
    })
    expect(collector.has_errors()).toBe(false)

    const memory = memory_collector()
    const edgeCtx = await create_context(
      { sub: { list } },
      list,
      ['bun', 'fs', 'list', '-ao'],
      3,
      memory.collector,
    )

    expect(edgeCtx.flags).toEqual({
      all: false,
      long: false,
      human: false,
      output: 'stdout',
    })
    expect(edgeCtx.unkFlags).toEqual(['-ao'])
    expect(memory.descriptions()).toEqual(['Unknown flag occurred'])
  })

  it('supports variadic array flag values with comma and whitespace separators', async () => {
    const calculate = cmd(
      {
        args: args({
          target: {},
        }),
        flags: flags({
          number: { resolver: [Number], fallback: [] as number[] },
          label: {
            alias: 'l',
            resolver: [String],
            fallback: [] as string[],
          },
        }),
      },
      () => {},
    )
    const collector = quiet_collector()

    const ctx = await create_context(
      { sub: { calculate } },
      calculate,
      [
        'bun',
        'math',
        'calculate',
        '--number',
        '-1,-2',
        '--number',
        '1,2,3',
        '--number',
        '4,',
        '5,',
        '6',
        '--label=fast,',
        'green,',
        'safe',
        '--number',
        '7',
        '8',
        '9',
        'dist',
      ],
      3,
      collector,
    )

    expect(ctx.args).toEqual({ target: 'dist' })
    expect(ctx.flags).toEqual({
      number: [-1, -2, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      label: ['fast', 'green', 'safe'],
    })
    expect(ctx.unkArgs).toEqual([])
    expect(ctx.unkFlags).toEqual([])
    expect(collector.has_errors()).toBe(false)

    const memory = memory_collector()
    const missingCtx = await create_context(
      { sub: { calculate } },
      calculate,
      ['bun', 'math', 'calculate', '--number', '--label', 'done', 'dist'],
      3,
      memory.collector,
    )

    expect(missingCtx.args).toEqual({ target: 'dist' })
    expect(missingCtx.flags).toEqual({ number: [], label: ['done'] })
    expect(memory.descriptions()).toEqual(['Missing flag value'])
  })

  it('can disable variadic array flag values', async () => {
    const calculate = cmd(
      {
        args: args({
          target: {},
        }),
        flags: flags({
          number: { resolver: [Number], fallback: [] as number[] },
        }),
      },
      () => {},
    )
    const collector = quiet_collector()

    const ctx = await create_context(
      {
        config: {
          tweaks: {
            variadicFlagValues: false,
          },
        },
        sub: { calculate },
      },
      calculate,
      ['bun', 'math', 'calculate', '--number', '1', '2'],
      3,
      collector,
    )

    expect(ctx.args).toEqual({ target: '2' })
    expect(ctx.flags).toEqual({ number: [1] })
    expect(collector.has_errors()).toBe(false)
  })

  it('reserves required positional values around variadic array flags', async () => {
    const scalarArgs = cmd(
      {
        args: args({
          project: {},
          target: {},
        }),
        flags: flags({
          number: { resolver: [Number], fallback: [] as number[] },
        }),
      },
      () => {},
    )
    const scalarCollector = quiet_collector()

    const scalarCtx = await create_context(
      { sub: { scalarArgs } },
      scalarArgs,
      ['bun', 'math', 'scalarArgs', 'core', '--number', '1', '2', 'dist'],
      3,
      scalarCollector,
    )

    expect(scalarCtx.args).toEqual({ project: 'core', target: 'dist' })
    expect(scalarCtx.flags).toEqual({ number: [1, 2] })
    expect(scalarCollector.has_errors()).toBe(false)

    const restArgs = cmd(
      {
        args: args({
          files: { resolver: [String] },
        }),
        flags: flags({
          number: { resolver: [Number], fallback: [] as number[] },
        }),
      },
      () => {},
    )
    const futureRestCollector = quiet_collector()

    const futureRestCtx = await create_context(
      { sub: { restArgs } },
      restArgs,
      ['bun', 'math', 'restArgs', '--number', '1', '2', 'src/index.ts'],
      3,
      futureRestCollector,
    )

    expect(futureRestCtx.args).toEqual({ files: ['src/index.ts'] })
    expect(futureRestCtx.flags).toEqual({ number: [1, 2] })
    expect(futureRestCollector.has_errors()).toBe(false)

    const usedRestCollector = quiet_collector()
    const usedRestCtx = await create_context(
      { sub: { restArgs } },
      restArgs,
      ['bun', 'math', 'restArgs', 'src/index.ts', '--number', '1', '2'],
      3,
      usedRestCollector,
    )

    expect(usedRestCtx.args).toEqual({ files: ['src/index.ts'] })
    expect(usedRestCtx.flags).toEqual({ number: [1, 2] })
    expect(usedRestCollector.has_errors()).toBe(false)

    const optionalArg = cmd(
      {
        args: args({
          target: { required: false },
        }),
        flags: flags({
          number: { resolver: [Number], fallback: [] as number[] },
        }),
      },
      () => {},
    )
    const optionalCollector = quiet_collector()

    const optionalCtx = await create_context(
      { sub: { optionalArg } },
      optionalArg,
      ['bun', 'math', 'optionalArg', '--number', '1', '2'],
      3,
      optionalCollector,
    )

    expect(optionalCtx.args).toEqual({})
    expect(optionalCtx.flags).toEqual({ number: [1, 2] })
    expect(optionalCollector.has_errors()).toBe(false)
  })

  it('can disable parser compatibility tweaks', async () => {
    const serve = cmd(
      {
        flags: flags({
          cache: { resolver: Boolean, fallback: true },
          all: { alias: 'a', resolver: Boolean, fallback: false },
          long: { alias: 'l', resolver: Boolean, fallback: false },
          threshold: { resolver: Number },
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      {
        config: {
          tweaks: {
            booleanNegation: false,
            shortBooleanClusters: false,
            variadicFlagValues: false,
            negativeNumberValues: false,
          },
        },
        sub: { serve },
      },
      serve,
      ['bun', 'web', 'serve', '--no-cache', '-al', '--threshold', '-10'],
      3,
      memory.collector,
    )

    expect(ctx.flags).toEqual({ cache: true, all: false, long: false })
    expect(ctx.unkFlags).toEqual(['--no-cache', '-al', '-10'])
    expect(memory.descriptions()).toEqual([
      'Unknown flag occurred',
      'Unknown flag occurred',
      'Missing flag value',
      'Unknown flag occurred',
    ])

    const number = cmd(
      {
        flags: flags({
          value: { resolver: [Number], fallback: [] as number[] },
        }),
      },
      () => {},
    )
    const negativeMemory = memory_collector()

    const negativeCtx = await create_context(
      {
        config: {
          tweaks: {
            negativeNumberValues: false,
          },
        },
        sub: { number },
      },
      number,
      ['bun', 'web', 'number', '--value', '-1'],
      3,
      negativeMemory.collector,
    )

    expect(negativeCtx.flags).toEqual({ value: [] })
    expect(negativeCtx.unkFlags).toEqual(['-1'])
    expect(negativeMemory.descriptions()).toEqual([
      'Missing flag value',
      'Unknown flag occurred',
    ])
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
      ['bun', 'pack', 'archive', 'README.md', 'src/index.ts'],
      3,
      collector,
    )

    expect(ctx.args).toEqual({ files: ['README.md', 'src/index.ts'] })
    expect(ctx.flags).toEqual({})
    expect(collector.has_errors()).toBe(false)
  })

  it('reports duplicate flag aliases without letting later flags overwrite earlier mappings', async () => {
    const copy = cmd(
      {
        flags: flags({
          output: { alias: 'o' },
          overwrite: { alias: 'o', resolver: Boolean },
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      { sub: { copy } },
      copy,
      ['bun', 'fs', 'copy', '-o', 'dist/app.js'],
      3,
      memory.collector,
    )

    expect(ctx.flags).toEqual({ output: 'dist/app.js' })
    expect(memory.descriptions()).toContain('Invalid flag schema')
    expect(memory.text()).toContain('already used by `output`')
  })

  it('reports invalid flag names and aliases without registering malformed tokens', async () => {
    const inspect = cmd(
      {
        flags: flags({
          '': {},
          '-bad': {},
          'debug': { alias: ['', '-d'] as const, resolver: Boolean },
          'good': { alias: 'g', resolver: Boolean },
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      { sub: { inspect } },
      inspect,
      ['bun', 'tool', 'inspect', '-d', '-g'],
      3,
      memory.collector,
    )

    expect(ctx.flags).toEqual({ good: true })
    expect(ctx.unkFlags).toEqual(['-d'])
    expect(memory.descriptions()).toContain('Invalid flag schema')
    expect(memory.descriptions()).toContain('Unknown flag occurred')
    expect(memory.text()).toContain('Flag name must not be empty')
    expect(memory.text()).toContain('Alias for `debug`')
  })

  it('reports ambiguous positional schemas when a rest argument is not last', async () => {
    const move = cmd(
      {
        args: args({
          sources: { resolver: [String] },
          destination: {},
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      { sub: { move } },
      move,
      ['bun', 'fs', 'move', 'a.txt', 'b.txt', 'archive/'],
      3,
      memory.collector,
    )

    expect(ctx.args).toEqual({ sources: ['a.txt', 'b.txt', 'archive/'] })
    expect(memory.descriptions()).toContain('Invalid argument schema')
    expect(memory.text()).toContain('must be the last argument')
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
      ['bun', 'cms', 'schedule', '2026-06-09', '--published=maybe'],
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
      ['bun', 'asset', 'convert', 'design.fig', '--mode=fast'],
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

  it('reports non-Error failures from array argument resolvers', async () => {
    const fail_each = (raw: string) => {
      throw `cannot decode ${raw}`
    }
    const import_assets = cmd(
      {
        args: args({
          assets: { resolver: [fail_each] },
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      { sub: { import_assets } },
      import_assets,
      ['bun', 'asset', 'import_assets', 'hero.png'],
      3,
      memory.collector,
    )

    expect(ctx.args).toEqual({})
    expect(memory.descriptions()).toEqual(['Invalid argument value'])
    expect(memory.text()).toContain('`assets` is invalid')
  })

  it('covers defensive parser edges for aliases, terminal flag values, and malformed array resolvers', async () => {
    const send = cmd(
      {
        args: args({
          files: { resolver: [] as unknown as [StringConstructor] },
        }),
        flags: flags({
          force: { alias: ['f', 'force'] as const, resolver: Boolean },
          output: {},
        }),
      },
      () => {},
    )
    const memory = memory_collector()

    const ctx = await create_context(
      { sub: { send } },
      send,
      ['bun', 'mail', 'send', 'letter.md', '-f', '--output'],
      3,
      memory.collector,
    )

    expect(ctx.args).toEqual({})
    expect(ctx.flags).toEqual({ force: true })
    expect(memory.descriptions()).toEqual([
      'Missing flag value',
      'Invalid argument value',
    ])
    expect(memory.text()).toContain(
      'Array resolver must contain a resolver',
    )
  })
})
