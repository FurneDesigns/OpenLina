import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

interface VerificationCheck {
  name: string
  command: string
  args: string[]
  ok: boolean
  exitCode: number | null
  output: string
  durationMs: number
}

export interface VerificationReport {
  checks: VerificationCheck[]
  hasFailures: boolean
  ranAt: number
}

interface CacheEntry { report: VerificationReport; ts: number }
const cache = new Map<string, CacheEntry>()
const TTL = 90_000
const OUT_CAP = 8_192

function readPkg(workspacePath: string): any | null {
  const p = path.join(workspacePath, 'package.json')
  if (!fs.existsSync(p)) return null
  try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null }
}

function capOut(s: string): string {
  if (s.length <= OUT_CAP) return s
  return `${s.slice(0, OUT_CAP / 2)}\n[... truncated ...]\n${s.slice(-OUT_CAP / 2)}`
}

function runCmd(cwd: string, command: string, args: string[], timeoutMs: number): Promise<{ ok: boolean; code: number | null; output: string; durationMs: number }> {
  return new Promise((resolve) => {
    const start = Date.now()
    let out = ''
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env })
    const t = setTimeout(() => { try { child.kill('SIGKILL') } catch {} }, timeoutMs)
    child.stdout.on('data', (d) => { out += d.toString() })
    child.stderr.on('data', (d) => { out += d.toString() })
    child.on('exit', (code) => {
      clearTimeout(t)
      resolve({ ok: code === 0, code, output: capOut(out), durationMs: Date.now() - start })
    })
    child.on('error', (err) => {
      clearTimeout(t)
      resolve({ ok: false, code: null, output: capOut(`${out}\n${String(err)}`), durationMs: Date.now() - start })
    })
  })
}

export async function runVerificationChecks(workspacePath: string): Promise<VerificationReport> {
  const cached = cache.get(workspacePath)
  if (cached && Date.now() - cached.ts < TTL) return cached.report

  const pkg = readPkg(workspacePath)
  const checks: VerificationCheck[] = []
  if (!pkg) {
    const report: VerificationReport = { checks, hasFailures: false, ranAt: Date.now() }
    cache.set(workspacePath, { report, ts: Date.now() })
    return report
  }
  const scripts = pkg.scripts || {}
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }

  if (scripts.build) {
    const r = await runCmd(workspacePath, 'npm', ['run', 'build', '--silent'], 5 * 60_000)
    checks.push({ name: 'build', command: 'npm run build', args: [], ...r })
  }
  if (scripts.lint) {
    const r = await runCmd(workspacePath, 'npm', ['run', 'lint', '--silent'], 2 * 60_000)
    checks.push({ name: 'lint', command: 'npm run lint', args: [], ...r })
  } else if (deps.eslint) {
    const r = await runCmd(workspacePath, 'npx', ['eslint', '.'], 2 * 60_000)
    checks.push({ name: 'lint', command: 'npx eslint .', args: [], ...r })
  }
  const tsconfigExists = fs.existsSync(path.join(workspacePath, 'tsconfig.json'))
  if (scripts.typecheck) {
    const r = await runCmd(workspacePath, 'npm', ['run', 'typecheck', '--silent'], 2 * 60_000)
    checks.push({ name: 'typecheck', command: 'npm run typecheck', args: [], ...r })
  } else if (tsconfigExists) {
    const r = await runCmd(workspacePath, 'npx', ['tsc', '--noEmit'], 2 * 60_000)
    checks.push({ name: 'typecheck', command: 'npx tsc --noEmit', args: [], ...r })
  }
  if (scripts.test && !/echo\s+(\\")?Error/i.test(scripts.test)) {
    const r = await runCmd(workspacePath, 'npm', ['test', '--', '--run'], 5 * 60_000)
    checks.push({ name: 'test', command: 'npm test', args: [], ...r })
  }

  const report: VerificationReport = {
    checks,
    hasFailures: checks.some((c) => !c.ok),
    ranAt: Date.now(),
  }
  cache.set(workspacePath, { report, ts: Date.now() })
  return report
}

export function clearVerificationCache(): void { cache.clear() }

export function formatReportForPrompt(report: VerificationReport): string {
  if (report.checks.length === 0) return 'No deterministic verification checks were available.'
  const parts: string[] = []
  parts.push(`Deterministic verification ran at ${new Date(report.ranAt).toISOString()}:`)
  for (const c of report.checks) {
    parts.push(`- ${c.name}: ${c.ok ? 'PASS' : 'FAIL'} (exit=${c.exitCode}, ${c.durationMs}ms)`)
    if (!c.ok) parts.push('```\n' + c.output.trim() + '\n```')
  }
  parts.push(report.hasFailures ? '⚠ Failures present — request changes.' : '✅ All checks passed.')
  return parts.join('\n')
}
