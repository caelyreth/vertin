import { describe, expect, it } from 'bun:test'

import { args, cmd, flags, snippet } from '@/helper'
import { internal_commands } from '@/internal'
import { prepare } from '@/schema'

import { invoke_app, memory_collector } from './shared'

describe('prepared execution pipeline', () => {
  it('binds named help, option help and the group default to the same command', async () => {
    const spec = {
      sub: { leaf: cmd({ args: args({ name: {} }) }, () => {}) },
    }
    const memory = memory_collector()
    const root = prepare(spec, internal_commands(spec), memory.collector)
    const named = root.children.get('help')!.action.command
    const option = root.actions.find(({ key }) => key === 'help')!.action
      .command
    expect(root.action.command).toBe(named)
    expect(option).toBe(named)
    const explicit = await invoke_app(spec, ['help', 'leaf'])
    const flagged = await invoke_app(spec, ['leaf', '--help'])
    expect(flagged).toEqual(explicit)
  })

  it('parses boolean clusters before subcommands even when a root action exists', async () => {
    let root = false
    let received: unknown
    const common = snippet({
      flags: flags({
        verbose: { alias: 'v', resolver: Boolean },
        quiet: { alias: 'q', resolver: Boolean },
      }),
    })
    const leaf = cmd({ use: [common] }, (ctx) => {
      received = ctx.flags
    })
    const result = await invoke_app(
      {
        flags: common.flags,
        main: cmd({}, () => {
          root = true
        }),
        sub: { leaf },
      },
      ['-vq', 'leaf'],
    )
    expect(result.exitCode).toBe(0)
    expect(root).toBe(false)
    expect(received).toEqual({ verbose: true, quiet: true })
  })

  it('treats scalar option values as values even when they name a command', async () => {
    let received: unknown
    const common = snippet({ flags: flags({ label: {} }) })
    const deploy = cmd({ use: [common] }, (ctx) => {
      received = ctx.flags.label
    })
    const spec = { flags: common.flags, sub: { deploy } }
    const result = await invoke_app(spec, ['--label', 'help', 'deploy'])
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toBe('')
    expect(received).toBe('help')
  })

  it('shares root flags with descendants without sharing root arguments', async () => {
    let received: unknown
    const common = snippet({
      flags: flags({
        include: { resolver: [String] },
        delta: { resolver: Number },
      }),
    })
    const main = cmd(
      { use: [common], args: args({ rootOnly: {} }) },
      () => {},
    )
    const leaf = cmd(
      { use: [common], args: args({ target: { required: false } }) },
      (ctx) => {
        received = ctx
      },
    )
    const result = await invoke_app({ main, sub: { leaf } }, [
      '--include',
      'a',
      'b',
      '--delta',
      '-2',
      'leaf',
      'target',
    ])
    expect(result.exitCode).toBe(0)
    expect(received).toMatchObject({
      args: { target: 'target' },
      flags: { include: ['a', 'b'], delta: -2 },
    })
  })

  it('stops command selection once positional input or -- is reached', async () => {
    let received: unknown
    let child = false
    const main = cmd(
      { args: args({ files: { resolver: [String] } }) },
      (ctx) => {
        received = ctx.args.files
      },
    )
    const spec = {
      main,
      sub: {
        leaf: cmd({}, () => {
          child = true
        }),
      },
    }
    expect((await invoke_app(spec, ['value', 'leaf'])).exitCode).toBe(0)
    expect(received).toEqual(['value', 'leaf'])
    expect((await invoke_app(spec, ['--', 'leaf'])).exitCode).toBe(0)
    expect(received).toEqual(['leaf'])
    expect(child).toBe(false)
    const group = await invoke_app({ sub: spec.sub }, ['--', 'leaf'])
    expect(group.exitCode).toBe(1)
    expect(group.stdout).toBe('')
  })

  it('does not mutate application schemas when mounting internal commands', async () => {
    const leaf = cmd(
      { flags: flags({ count: { resolver: Number } }) },
      () => {},
    )
    const sub = Object.freeze({ leaf })
    const spec = Object.freeze({ ver: '1', sub })
    const first = await invoke_app(spec, ['leaf', '--help'])
    const second = await invoke_app(spec, ['help', 'leaf'])
    expect(first).toEqual(second)
    expect(Object.keys(sub)).toEqual(['leaf'])
    expect(Object.keys(leaf.flags ?? {})).toEqual(['count'])
    expect(leaf.sub).toBeUndefined()
  })

  it('rejects structurally invalid argument schemas before help can run', async () => {
    const main = cmd(
      { args: args({ rest: { resolver: [String] }, last: {} }) },
      () => {},
    )
    const result = await invoke_app({ main }, ['--help'])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Invalid argument schema')
  })

  it('uses the scope collector after ordinary handlers as well as internal handlers', async () => {
    const main = cmd({}, (ctx) => {
      ctx._.collector.submit({ level: 'error', desc: 'Reported by action' })
    })
    const result = await invoke_app({ main }, [])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Reported by action')
    const badHelp = await invoke_app({ sub: { leaf: cmd({}) } }, [
      'help',
      'missing',
    ])
    expect(badHelp.exitCode).toBe(1)
    expect(badHelp.stderr).toContain('Invalid command occurred')
    expect(badHelp.stderr).not.toContain('Handler failed')
  })

  it('keeps ordinary field names independent of object prototypes', async () => {
    let received: unknown
    const main = cmd(
      { flags: flags({ constructor: {}, ['__proto__']: {} }) },
      (ctx) => {
        received = [ctx.flags.constructor, ctx.flags.__proto__]
      },
    )
    const result = await invoke_app({ main }, [
      '--constructor=one',
      '--__proto__=two',
    ])
    expect(result.exitCode).toBe(0)
    expect(received).toEqual(['one', 'two'])
  })

  it('formats structured and circular check failures without escaping the pipeline', async () => {
    const circular: { self?: unknown } = {}
    circular.self = circular
    const main = cmd(
      {
        flags: flags({
          structured: {
            fallback: 'x',
            check: () => {
              throw { code: 'denied' }
            },
          },
          circular: {
            fallback: 'x',
            check: () => {
              throw circular
            },
          },
        }),
      },
      () => {},
    )
    const result = await invoke_app({ main }, [])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('Check failed')
    expect(result.stderr).toContain('{"code":"denied"}')
    expect(result.stderr).toContain('[object Object]')
    expect(result.stderr).not.toContain('Handler failed')
  })

  it('does not widen absent command schemas to an arbitrary flag bag', () => {
    cmd({}, (ctx) => {
      // @ts-expect-error No such flag is declared in this command.
      expect(ctx.flags.missing).toBeUndefined()
      // @ts-expect-error No such argument is declared in this command.
      expect(ctx.args.missing).toBeUndefined()
    })
    expect(true).toBe(true)
  })
})
