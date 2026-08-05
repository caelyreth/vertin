import { describe, expect, it } from 'vitest'

import { match } from '../src/core'
import { invalid_command, no_command_specified } from '../src/errors'
import { cmd } from '../src/helper'
import { err, ok } from '../src/utils'

describe('command matching', () => {
  const root = cmd({}, () => {})
  const commit = cmd({}, () => {})
  const push = cmd({ sub: { commit } }, () => {})

  it('uses main command when input starts with a flag', () => {
    expect(
      match({ main: root }, ['node', 'gitish', '--version'], 2),
    ).toEqual(ok([root, 2]))
  })

  it('reports a flag-only invocation when no main command exists', () => {
    expect(match({}, ['node', 'gitish', '--version'], 2)).toEqual(
      err(no_command_specified),
    )
  })

  it('matches nested subcommands and returns the remaining argv offset', () => {
    expect(
      match(
        { sub: { push } },
        ['node', 'gitish', 'push', 'commit', 'src'],
        2,
      ),
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
    expect(match({}, ['node', 'gitish', '-'], 2)).toEqual(
      err(invalid_command(['node', 'gitish', '-'], 2, '-')),
    )
    expect(match({}, ['node', 'gitish'], 2)).toEqual(
      err(no_command_specified),
    )
  })
})
