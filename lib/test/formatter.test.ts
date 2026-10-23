import { describe, expect, it } from 'bun:test'

import { create_formatter } from '@/renderer'

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
