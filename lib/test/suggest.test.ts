import { describe, expect, it } from 'bun:test'

import { args, cmd, flags } from '@/helper'
import { suggest_hint } from '@/suggest'

import { invoke_app } from './shared'

describe('typo suggestions', () => {
  it.each([
    ['deply', 'deploy'],
    ['deplloy', 'deploy'],
    ['depliy', 'deploy'],
    ['--hepl', '--help'],
    ['--verison', '--version'],
  ])('suggests %s as %s', (input, candidate) => {
    expect(suggest_hint(input, [candidate])).toBe(
      `Did you mean \`${candidate}\`?`,
    )
  })

  it('avoids unrelated or very short guesses and orders ties deterministically', () => {
    expect(suggest_hint('unrelated', ['deploy'])).toBeUndefined()
    expect(suggest_hint('-x', ['-h', '-v'])).toBeUndefined()
    expect(suggest_hint('cat', ['cut', 'bat', 'bat', 'car'])).toBe(
      'Did you mean `bat` or `car` or `cut`?',
    )
  })

  it('suggests root and nested command names without executing them', async () => {
    let handled = false
    const deploy = cmd({ alias: 'publish' }, () => {
      handled = true
    })
    const remote = cmd({ sub: { deploy } }, () => {
      handled = true
    })
    const spec = { sub: { remote, deploy } }
    const root = await invoke_app(spec, ['deply'])
    expect(root.stderr).toContain('Did you mean `deploy`?')
    const nested = await invoke_app(spec, ['remote', 'publsh'])
    expect(nested.stderr).toContain('Did you mean `publish`?')
    expect(nested.exitCode).toBe(1)
    expect(handled).toBe(false)
  })

  it.each([
    ['--hepl', '--help'],
    ['--verison', '--version'],
    ['--no-cahce', '--no-cache'],
    ['--destinaton=x', '--destination'],
  ])('suggests the active option %s as %s', async (input, expected) => {
    const leaf = cmd(
      { flags: flags({ output: { alias: 'destination' } }) },
      () => {},
    )
    const spec = {
      ver: '1',
      flags: flags({ cache: { resolver: Boolean } }),
      sub: { leaf },
    }
    const result = await invoke_app(spec, ['leaf', input])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain(`Did you mean \`${expected}\`?`)
    const unrelated = await invoke_app(spec, ['--destinaton=x'])
    expect(unrelated.stderr).not.toContain('Did you mean `--destination`?')
  })

  it('includes suggestions alongside expected choices', async () => {
    const main = cmd(
      { args: args({ format: { choices: ['json', 'text'] } }) },
      () => {},
    )
    const result = await invoke_app({ main }, ['jsoon'])
    expect(result.stderr).toContain('Invalid parameter choice')
    expect(result.stderr).toContain('Expected')
    expect(result.stderr).toContain('Did you mean `json`?')
  })

  it('leaves literal positional values untouched', async () => {
    let value: unknown
    const main = cmd({ args: args({ literal: {} }) }, (ctx) => {
      value = ctx.args.literal
    })
    const result = await invoke_app({ main }, ['--', '--hepl'])
    expect(result.stderr).toBe('')
    expect(value).toBe('--hepl')
  })
})
