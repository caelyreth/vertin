import { run } from '@/app'
import { create_collector } from '@/collector'
import type { _Collector, _Many, _Message, App } from '@/types'

export interface _CapturedStderr {
  readonly chunks: string[]
  readonly text: () => string
  readonly restore: () => void
}

function to_array<T>(value: _Many<T>): readonly T[] {
  return Array.isArray(value) ? value : [value as T]
}

export function set_argv(argv: readonly string[]): void {
  Bun.argv.splice(0, Bun.argv.length, ...argv)
}

export function capture_stderr(): _CapturedStderr {
  const chunks: string[] = []
  const original = process.stderr.write.bind(process.stderr)

  const write: typeof process.stderr.write = (chunk) => {
    chunks.push(String(chunk))
    return true
  }

  process.stderr.write = write

  return {
    chunks,
    text: () => chunks.join(''),
    restore: () => {
      process.stderr.write = original
    },
  }
}

export async function invoke_app(spec: App, argv: readonly string[]) {
  const originalArgv = [...Bun.argv]
  const originalExitCode = process.exitCode
  const stderr = capture_stderr()
  try {
    set_argv(['bun', 'tool', ...argv])
    process.exitCode = 0
    await run(spec)
    return { stderr: stderr.text(), exitCode: process.exitCode }
  } finally {
    set_argv(originalArgv)
    process.exitCode = originalExitCode ?? 0
    stderr.restore()
  }
}

export function quiet_collector(): _Collector {
  const collector = create_collector()
  collector.log = collector.submit
  collector.collect = () => {}
  return collector
}

export function memory_collector() {
  const messages: _Message[] = []
  const collector: _Collector = {
    log: (msgs) => {
      messages.push(...to_array(msgs))
    },
    submit: (msgs) => {
      messages.push(...to_array(msgs))
    },
    collect: () => {},
    has_errors: () => messages.some((msg) => msg.level === 'error'),
  }

  return {
    collector,
    messages,
    descriptions: () => messages.map((msg) => msg.desc),
    text: () =>
      messages.map((msg) => msg.diag?.markup ?? msg.desc).join('\n'),
  }
}
