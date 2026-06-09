import { describe, expect, it } from 'vitest'

import { create_collector } from '../src/collector'
import { match } from '../src/core'
import { invalid_command, no_command_specified } from '../src/errors'
import { create_formatter } from '../src/formatter'
import { cmd } from '../src/helper'
import { raw_len, red, strip } from '../src/tint'
import {
  err,
  is_err,
  is_ok,
  map_err,
  map_ok,
  ok,
  unwrap_or,
} from '../src/utils'

describe('result utilities', () => {
  it('creates, narrows, maps, and unwraps result values', () => {
    const good = ok(2)
    const bad = err(['missing'])

    expect(is_ok(good)).toBe(true)
    expect(is_err(bad)).toBe(true)
    expect(map_ok(good, (value) => value * 3)).toEqual(ok(6))
    expect(map_ok(bad, (value: number) => value * 3)).toBe(bad)
    expect(map_err(bad, (errors) => errors.join(', '))).toEqual(err('missing'))
    expect(map_err(good, (errors: string[]) => errors.join(', '))).toBe(good)
    expect(unwrap_or(good, 0)).toBe(2)
    expect(unwrap_or(bad, 0)).toBe(0)
  })
})

describe('formatter', () => {
  it('builds stable indented terminal text', () => {
    const fmt = create_formatter('..')

    fmt.line('root')
    fmt.indent()
    fmt.line('child')
    fmt.indent()
    fmt.line('leaf')
    fmt.shift()
    fmt.emptyLine()
    fmt.shift()
    fmt.shift()
    fmt.line('done')

    expect(fmt.raw()).toBe('root\n..child\n....leaf\n\ndone')
  })
})

describe('tint', () => {
  it('keeps raw text measurable when color is disabled', () => {
    const colored = red.bold`Delete ${'draft.txt'}`

    expect(strip(colored)).toBe('Delete draft.txt')
    expect(raw_len(colored)).toBe('Delete draft.txt'.length)
    expect(red('plain')).toBe('plain')
    expect(red(404 as unknown as string)).toBe('404')
  })
})

describe('command matching', () => {
  const root = cmd({}, () => {})
  const commit = cmd({}, () => {})
  const push = cmd({ sub: { commit } }, () => {})

  it('uses main command when input starts with a flag', () => {
    expect(match({ main: root }, ['node', 'gitish', '--version'], 2)).toEqual(
      ok([root, 2]),
    )
  })

  it('matches nested subcommands and returns the remaining argv offset', () => {
    expect(
      match({ sub: { push } }, ['node', 'gitish', 'push', 'commit', 'src'], 2),
    ).toEqual(ok([commit, 4]))
  })

  it('falls back to main when a token is not a subcommand', () => {
    expect(match({ main: root }, ['node', 'gitish', 'draft'], 2)).toEqual(
      ok([root, 2]),
    )
  })

  it('reports invalid and missing commands', () => {
    expect(match({}, ['node', 'gitish', 'unknown'], 2)).toEqual(
      err(invalid_command(['node', 'gitish', 'unknown'], 2, 'unknown')),
    )
    expect(match({}, ['node', 'gitish'], 2)).toEqual(err(no_command_specified))
  })
})

describe('collector', () => {
  it('queues diagnostics, formats them once, and tracks errors', () => {
    const written: string[] = []
    const original = process.stderr.write
    process.stderr.write = ((chunk: string | Uint8Array) => {
      written.push(String(chunk))
      return true
    }) as typeof process.stderr.write

    try {
      const collector = create_collector()

      collector.submit({
        level: 'warn',
        desc: 'Draft name adjusted',
        diag: {
          source: 'draft',
          offset: 0,
          markup: 'use lowercase names',
          expected: ['lowercase'],
          hint: 'Try `draft`',
        },
      })
      expect(written).toEqual([])
      expect(collector.has_errors()).toBe(false)

      collector.collect()
      collector.collect()

      expect(written.join('')).toContain('WARN Draft name adjusted')
      expect(written.join('')).toContain('Expected')
      expect(written.join('')).toContain('Hint')
      expect(written).toHaveLength(1)

      collector.log({ level: 'error', desc: 'Cannot write file' })
      expect(collector.has_errors()).toBe(true)

      collector.log(
        {
          level: 'info',
          desc: 'Workspace ready',
          diag: {
            source: 'workspace',
            offset: 0,
            markup: 'not shown in brief mode',
          },
        },
        true,
      )
      expect(written.join('')).toContain('INFO Workspace ready')
      expect(written.join('')).not.toContain('not shown in brief mode')
    } finally {
      process.stderr.write = original
    }
  })
})
