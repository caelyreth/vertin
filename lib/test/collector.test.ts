import { describe, expect, it } from 'vitest'

import { create_collector } from '@/collector'

import { capture_stderr } from './shared'

describe('collector', () => {
  it('queues diagnostics, formats them once, and tracks errors', () => {
    const stderr = capture_stderr()

    try {
      const collector = create_collector()

      collector.submit([
        {
          level: 'warn',
          desc: 'Draft name adjusted',
          diag: {
            source: 'draft',
            offset: 0,
            markup: 'use lowercase names',
            expected: ['lowercase'],
            hint: 'Try `draft`',
          },
        },
        {
          level: 'info',
          desc: 'Workspace scanned',
          diag: {
            prefix: '> ',
            source: ['craft', 'make', 'blog'],
            offset: 1,
            markup: 'selected command',
            expected: 'command name',
            hint: ['Run `craft help make`'],
          },
        },
      ])
      expect(stderr.chunks).toEqual([])
      expect(collector.has_errors()).toBe(false)

      collector.collect()
      collector.collect()

      expect(stderr.text()).toContain('WARN Draft name adjusted')
      expect(stderr.text()).toContain('INFO Workspace scanned')
      expect(stderr.text()).toContain('Expected')
      expect(stderr.text()).toContain('Hint')
      expect(stderr.text()).toContain('selected command')
      expect(stderr.chunks).toHaveLength(2)

      collector.log([
        { level: 'error', desc: 'Cannot write file' },
        {
          level: 'info',
          desc: 'Workspace ready',
          diag: {
            source: 'workspace',
            offset: 0,
            markup: 'not shown in brief mode',
          },
        },
      ])
      expect(collector.has_errors()).toBe(true)

      collector.log(
        {
          level: 'info',
          desc: 'Brief mode',
          diag: {
            source: 'workspace',
            offset: 0,
            markup: 'hidden diagnostic',
          },
        },
        true,
      )
      expect(stderr.text()).toContain('INFO Brief mode')
      expect(stderr.text()).not.toContain('hidden diagnostic')

      collector.log({
        level: 'warn',
        desc: 'No source tokens',
        diag: {
          source: [],
          offset: 0,
          markup: 'nothing to mark',
        },
      })
      expect(stderr.text()).toContain('WARN No source tokens')
    } finally {
      stderr.restore()
    }
  })
})
