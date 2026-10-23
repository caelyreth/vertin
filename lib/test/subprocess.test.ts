import { describe, expect, it } from 'bun:test'

const fixture = Bun.fileURLToPath(
  new URL('./fixtures/cli.ts', import.meta.url),
)

async function invoke(argv: string[]) {
  const child = Bun.spawn([process.execPath, fixture, ...argv], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...Bun.env, NO_COLOR: '1' },
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { stdout, stderr, exitCode }
}

describe('Bun CLI subprocess', () => {
  it('reads actual arguments and exits successfully', async () => {
    const result = await invoke(['world', '--count=2'])

    expect(result.exitCode).toBe(0)
    expect(result.stderr).toBe('')
    expect(result.stdout).toBe('{"name":"world","count":2}\n')
  })

  it('writes parsing diagnostics to stderr and exits with failure', async () => {
    const result = await invoke(['world', '--count=many', '--unknown'])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Invalid flag value')
    expect(result.stderr).toContain('Unknown flag occurred')
  })

  it('preserves handler failure exit semantics', async () => {
    const result = await invoke(['world', '--fail'])

    expect(result.exitCode).toBe(1)
    expect(result.stdout).toBe('')
    expect(result.stderr).toContain('Handler failed')
    expect(result.stderr).toContain('fixture failed')
  })
})
