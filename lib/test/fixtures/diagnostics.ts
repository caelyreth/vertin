import { create_collector } from '../../src/collector'

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
  { level: 'info', desc: 'Workspace scanned' },
  { level: 'error', desc: 'Cannot write file' },
])
collector.collect()
collector.collect()
