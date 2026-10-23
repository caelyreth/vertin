import { describe, expect, it } from 'bun:test'

import { match } from '@/core'
import { invalid_command, no_command_specified } from '@/errors'
import { cmd } from '@/helper'
import { err, ok } from '@/utils'

describe('command matching', () => {
  const root = cmd({}, () => {})
  const commit = cmd({}, () => {})
  const push = cmd({ sub: { commit } }, () => {})

  it('uses main command when input starts with a flag', () => {
    expect(
      match({ main: root }, ['bun', 'gitish', '--version'], 2),
    ).toEqual(ok([root, 2]))
  })

  it('reports a flag-only invocation when no main command exists', () => {
    expect(match({}, ['bun', 'gitish', '--version'], 2)).toEqual(
      err(no_command_specified),
    )
  })

  it('matches nested subcommands and returns the remaining argv offset', () => {
    expect(
      match(
        { sub: { push } },
        ['bun', 'gitish', 'push', 'commit', 'src'],
        2,
      ),
    ).toEqual(ok([commit, 4]))
  })

  it('falls back to main when a token is not a subcommand', () => {
    expect(match({ main: root }, ['bun', 'gitish', 'draft'], 2)).toEqual(
      ok([root, 2]),
    )
  })

  it('reports invalid and missing commands', () => {
    expect(match({}, ['bun', 'gitish', 'unknown'], 2)).toEqual(
      err(invalid_command(['bun', 'gitish', 'unknown'], 2, 'unknown')),
    )
    expect(match({}, ['bun', 'gitish', '-'], 2)).toEqual(
      err(invalid_command(['bun', 'gitish', '-'], 2, '-')),
    )
    expect(match({}, ['bun', 'gitish'], 2)).toEqual(
      err(no_command_specified),
    )
  })
})
