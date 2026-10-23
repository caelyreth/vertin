import { describe, expect, it } from 'bun:test'

import { strip } from '@/tint'

const fixture = Bun.fileURLToPath(
  new URL('./fixtures/diagnostics.ts', import.meta.url),
)

async function render_diagnostics(color: boolean) {
  const child = Bun.spawn([process.execPath, fixture], {
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...Bun.env,
      NO_COLOR: color ? '' : '1',
      FORCE_COLOR: color ? '1' : '',
      NODE_DISABLE_COLORS: '',
    },
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ])
  return { stdout, stderr, exitCode }
}

describe('terminal diagnostics', () => {
  it('preserves diagnostic text with color enabled or disabled', async () => {
    const [plain, colored] = await Promise.all([
      render_diagnostics(false),
      render_diagnostics(true),
    ])

    expect(plain.exitCode).toBe(0)
    expect(colored.exitCode).toBe(0)
    expect(plain.stdout).toBe('')
    expect(colored.stdout).toBe('')
    expect(plain.stderr).not.toContain('\x1b[')
    expect(colored.stderr).toContain('\x1b[')
    expect(strip(colored.stderr)).toBe(plain.stderr)
    expect(plain.stderr).toContain('WARN Draft name adjusted')
    expect(plain.stderr).toContain('INFO Workspace scanned')
    expect(plain.stderr).toContain('ERROR Cannot write file')
    expect(plain.stderr.match(/Workspace scanned/g)).toHaveLength(1)
  })
})
