import { describe, expect, it } from 'bun:test'

import { app, args, check, cmd, flags, snippet } from '@/helper'
import type { Argument, Flag } from '@/types'

import { invoke_app } from './shared'

type _Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false

describe('declarative type inference', () => {
  it('keeps concrete parameter members at every authoring boundary', () => {
    type _FlagSpec = { port: { resolver: NumberConstructor } }
    type _ArgSpec = { input: {} }
    type _HelperFlag = Parameters<typeof flags<_FlagSpec>>[0][string]
    type _HelperArg = Parameters<typeof args<_ArgSpec>>[0][string]
    type _CommandFlag = NonNullable<
      Parameters<typeof cmd<{}, _FlagSpec>>[0]['flags']
    >[string]
    type _CommandArg = NonNullable<
      Parameters<typeof cmd<_ArgSpec>>[0]['args']
    >[string]
    type _SnippetFlag = NonNullable<
      Parameters<typeof snippet<{ flags: _FlagSpec }>>[0]['flags']
    >[string]
    type _SnippetArg = NonNullable<
      Parameters<typeof snippet<{ args: _ArgSpec }>>[0]['args']
    >[string]
    type _AppFlag = NonNullable<
      Parameters<typeof app<{}, _FlagSpec>>[0]['flags']
    >[string]
    const members: [
      _Equal<keyof _HelperFlag, keyof Flag>,
      _Equal<keyof _HelperArg, keyof Argument>,
      _Equal<keyof _CommandFlag, keyof Flag>,
      _Equal<keyof _CommandArg, keyof Argument>,
      _Equal<keyof _SnippetFlag, keyof Flag>,
      _Equal<keyof _SnippetArg, keyof Argument>,
      _Equal<keyof _AppFlag, keyof Flag>,
    ] = [true, true, true, true, true, true, true]
    expect(members.every(Boolean)).toBe(true)
  })

  it('infers and executes inline records without args() or flags()', async () => {
    let handled = false
    const common = snippet({
      flags: {
        verbose: { alias: 'v', resolver: Boolean, fallback: false },
        format: { choices: ['text', 'json'], fallback: 'text' },
      },
    })
    const deploy = cmd(
      {
        use: [common],
        args: {
          target: { choices: ['web', 'api'] },
          revision: { resolver: Number, required: false },
        },
        flags: {
          port: {
            alias: 'p',
            resolver: Number,
            fallback: 8080,
            check: check<number>(({ value }) => value > 0),
          },
          cache: { resolver: Boolean, fallback: true },
          label: {},
          retries: { resolver: Number, required: true },
          level: { resolver: [Number], choices: [1, 2], fallback: [] },
          length: {
            resolver: (raw) => {
              const input: _Equal<typeof raw, string> = true
              expect(input).toBe(true)
              return raw.length
            },
          },
        },
      },
      (ctx) => {
        const inferred: [
          _Equal<typeof ctx.args.target, 'web' | 'api'>,
          _Equal<typeof ctx.args.revision, number | undefined>,
          _Equal<typeof ctx.flags.port, number>,
          _Equal<typeof ctx.flags.cache, boolean>,
          _Equal<typeof ctx.flags.label, string | undefined>,
          _Equal<typeof ctx.flags.retries, number>,
          _Equal<typeof ctx.flags.level, (1 | 2)[]>,
          _Equal<typeof ctx.flags.length, number | undefined>,
          _Equal<typeof ctx.flags.verbose, boolean>,
          _Equal<typeof ctx.flags.format, 'text' | 'json'>,
        ] = [true, true, true, true, true, true, true, true, true, true]
        expect(inferred.every(Boolean)).toBe(true)
        expect(ctx.args).toEqual({ target: 'web', revision: 12 })
        expect(ctx.flags).toMatchObject({
          port: 8080,
          cache: true,
          retries: 3,
          level: [1, 2],
          length: 3,
          verbose: true,
          format: 'text',
        })
        handled = true
      },
    )
    const cli = app({ flags: common.flags, sub: { deploy } })
    const result = await invoke_app(cli, [
      '-v',
      'deploy',
      'web',
      '12',
      '--retries=3',
      '--level=1,2',
      '--length=abc',
    ])
    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(handled).toBe(true)
  })

  it('preserves helper literals, custom resolver types, and snippet inference', async () => {
    const record = flags({ port: { resolver: Number, fallback: 8080 } })
    const metadata: [
      _Equal<typeof record.port.resolver, NumberConstructor>,
      _Equal<typeof record.port.fallback, 8080>,
    ] = [true, true]
    expect(metadata).toEqual([true, true])
    const common = snippet({
      args: { source: { resolver: (raw) => raw.toUpperCase() } },
      flags: { url: { resolver: (raw) => new URL(raw), required: true } },
    })
    const main = cmd({ use: [common], flags: record }, (ctx) => {
      const inferred: [
        _Equal<typeof ctx.args.source, string>,
        _Equal<typeof ctx.flags.url, URL>,
        _Equal<typeof ctx.flags.port, number>,
      ] = [true, true, true]
      expect(inferred).toEqual([true, true, true])
      expect(ctx.args.source).toBe('SRC')
      expect(ctx.flags.url.hostname).toBe('example.com')
    })
    expect(
      (await invoke_app({ main }, ['src', '--url=https://example.com']))
        .exitCode,
    ).toBe(0)
    const cli = app({
      flags: { port: { resolver: Number, fallback: 8080 } },
    })
    const root: _Equal<
      NonNullable<typeof cli.flags>['port']['fallback'],
      8080
    > = true
    expect(root).toBe(true)
  })

  it('validates inline definitions as strictly as helper-wrapped definitions', () => {
    // @ts-expect-error Numeric resolvers do not accept string fallbacks.
    cmd({ flags: { port: { resolver: Number, fallback: 'bad' } } })
    // @ts-expect-error Choices must match the resolver.
    cmd({ args: { count: { resolver: Number, choices: ['one'] } } })
    cmd({
      // @ts-expect-error A fallback must belong to the allowed choices.
      flags: { format: { choices: ['text', 'json'], fallback: 'yaml' } },
    })
    cmd({
      args: {
        // @ts-expect-error Array fallback items must be allowed choices.
        level: { resolver: [Number], choices: [1, 2], fallback: [3] },
      },
    })
    cmd({
      flags: {
        // @ts-expect-error The checker must accept the resolved value type.
        port: { resolver: Number, check: check<string>(() => true) },
      },
    })
    // @ts-expect-error Global definitions must obey the same fallback contract.
    app({ flags: { port: { resolver: Number, fallback: 'bad' } } })
    // @ts-expect-error Plain snippet definitions retain choice validation.
    snippet({ flags: { mode: { choices: ['safe'], fallback: 'unsafe' } } })
    // @ts-expect-error Helpers still validate rather than widening fallback types.
    flags({ enabled: { resolver: Boolean, fallback: 'yes' } })
    // @ts-expect-error Missing resolvers default to strings, not inferred fallback types.
    args({ count: { fallback: 1 } })
    expect(true).toBe(true)
  })
})
