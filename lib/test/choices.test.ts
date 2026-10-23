import { describe, expect, it } from 'bun:test'

import { args, cmd, flags, snippet } from '@/helper'

import { context_for as create_context, memory_collector } from './shared'

describe('parameter choices', () => {
  it('validates resolved scalars, arrays, fallbacks, and snippet fields', async () => {
    const common = snippet({
      flags: flags({
        format: { choices: ['text', 'json'], fallback: 'text' },
      }),
    })
    const build = cmd(
      {
        use: [common],
        args: args({ target: { choices: ['web', 'api'] } }),
        flags: flags({ level: { resolver: [Number], choices: [1, 2] } }),
      },
      (ctx) => {
        const target: 'web' | 'api' = ctx.args.target
        const format: 'text' | 'json' = ctx.flags.format
        const level: (1 | 2)[] | undefined = ctx.flags.level
        expect([target, format, level]).toEqual(['web', 'text', [1, 2]])
      },
    )
    const memory = memory_collector()
    const ctx = await create_context(
      {},
      build,
      ['bun', 'tool', 'web', '--level=1,2'],
      2,
      memory.collector,
    )

    expect(ctx.args).toEqual({ target: 'web' })
    expect(ctx.flags).toEqual({ format: 'text', level: [1, 2] })
    expect(memory.collector.has_errors()).toBe(false)
  })

  it('collects all invalid choices and skips their checks', async () => {
    let checked = false
    const build = cmd(
      {
        args: args({ target: { choices: ['web', 'api'] } }),
        flags: flags({
          level: {
            resolver: [Number],
            choices: [1, 2],
            check: () => {
              checked = true
            },
          },
        }),
      },
      () => {},
    )
    const memory = memory_collector()
    const ctx = await create_context(
      {},
      build,
      ['bun', 'tool', 'other', '--level=1,3'],
      2,
      memory.collector,
    )

    expect(ctx.args).toEqual({})
    expect(ctx.flags).toEqual({})
    expect(checked).toBe(false)
    expect(memory.descriptions()).toEqual([
      'Invalid parameter choice',
      'Invalid parameter choice',
    ])
    expect(memory.messages[0]?.diag?.expected).toEqual(['web', 'api'])
    expect(memory.messages[1]?.diag?.expected).toEqual(['1', '2'])
  })

  it('validates fallbacks too and permits omitted optional fields', async () => {
    const memory = memory_collector()
    const ctx = await create_context(
      {},
      {
        flags: {
          mode: { choices: ['safe'], fallback: 'unsafe' },
          optional: { choices: ['x'] },
        },
        handler: () => {},
      },
      ['bun', 'tool'],
      2,
      memory.collector,
    )
    expect(ctx.flags).toEqual({})
    expect(memory.descriptions()).toEqual(['Invalid parameter choice'])
  })

  it('checks choice and fallback types when constructing specifications', () => {
    // @ts-expect-error Choices must match the resolver.
    flags({ count: { resolver: Number, choices: ['one'] } })
    // @ts-expect-error Fallback must be an allowed choice.
    flags({ format: { choices: ['text', 'json'], fallback: 'yaml' } })
    // @ts-expect-error Array fallback items must be allowed choices.
    args({ levels: { resolver: [Number], choices: [1, 2], fallback: [3] } })
    expect(true).toBe(true)
  })
})
