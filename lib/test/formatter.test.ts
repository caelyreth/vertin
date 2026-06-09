import { describe, expect, it } from 'vitest'

import { create_formatter } from '../src/formatter'

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
