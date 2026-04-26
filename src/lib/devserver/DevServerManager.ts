import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import net from 'node:net'
import { EventEmitter } from 'node:events'

interface DevServerInfo {
  projectId: string
  port: number
  url: string
  status: 'starting' | 'ready' | 'stopped' | 'failed'
  command: string
  logs: string[]
}

interface ProcessRec {
  proc: any
  info: DevServerInfo
  workspacePath: string
}

const STALE_LOCK_PATHS = [
  '.next/dev',
  '.next/cache/dev-server.json',
  'node_modules/.vite',
  '.nuxt/dev',
]

function canConnect(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const sock = new net.Socket()
    let done = false
    const finish = (ok: boolean) => {
      if (done) return; done = true
      try { sock.destroy() } catch {}
      resolve(ok)
    }
    sock.setTimeout(timeoutMs)
    sock.once('connect', () => finish(true))
    sock.once('error', () => finish(false))
    sock.once('timeout', () => finish(false))
    try { sock.connect(port, host) } catch { finish(false) }
  })
}

async function findAvailablePort(start: number, max = 200): Promise<number> {
  for (let p = start; p < start + max; p++) {
    const ok = await new Promise<boolean>((resolve) => {
      const srv = net.createServer()
      srv.once('error', () => resolve(false))
      srv.once('listening', () => srv.close(() => resolve(true)))
      srv.listen(p, '127.0.0.1')
    })
    if (ok) return p
  }
  throw new Error(`no available port in range ${start}..${start + max}`)
}

function clearStaleDevLocks(workspacePath: string): void {
  for (const rel of STALE_LOCK_PATHS) {
    const full = path.join(workspacePath, rel)
    try {
      if (!fs.existsSync(full)) continue
      const stat = fs.statSync(full)
      if (stat.isFile()) {
        try {
          const content = JSON.parse(fs.readFileSync(full, 'utf8'))
          if (content?.pid && typeof content.pid === 'number') {
            try { process.kill(content.pid, 'SIGTERM') } catch {}
          }
        } catch {}
        fs.unlinkSync(full)
      } else if (stat.isDirectory()) {
        fs.rmSync(full, { recursive: true, force: true })
      }
    } catch {}
  }
}

function detectDevCommand(workspacePath: string, port: number): { command: string; args: string[] } | null {
  const pkgPath = path.join(workspacePath, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  let pkg: any
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) } catch { return null }
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
  // Bind to 0.0.0.0 so the dev server is reachable from outside the WSL/container
  // network namespace (WSL2 host browser can't reach 127.0.0.1 of the WSL VM).
  if (deps.next) return { command: 'npx', args: ['next', 'dev', '-p', String(port), '-H', '0.0.0.0'] }
  if (deps.vite) return { command: 'npx', args: ['vite', '--port', String(port), '--strictPort', '--host', '0.0.0.0'] }
  if (deps.nuxt) return { command: 'npx', args: ['nuxt', 'dev', '--port', String(port), '--host', '0.0.0.0'] }
  if (deps.astro) return { command: 'npx', args: ['astro', 'dev', '--port', String(port), '--host', '0.0.0.0'] }
  if (pkg.scripts?.dev) return { command: 'npm', args: ['run', 'dev'] }
  return null
}

class DevServerManager extends EventEmitter {
  private rec = new Map<string, ProcessRec>()

  status(projectId: string): DevServerInfo | null {
    return this.rec.get(projectId)?.info || null
  }

  async start(projectId: string, workspacePath: string): Promise<DevServerInfo> {
    if (this.rec.has(projectId)) return this.rec.get(projectId)!.info
    if (!fs.existsSync(workspacePath)) throw new Error(`workspace not found: ${workspacePath}`)
    clearStaleDevLocks(workspacePath)
    if (!fs.existsSync(path.join(workspacePath, 'node_modules'))) {
      this.emit('log', { projectId, line: '$ npm install (first run, may take a minute)' })
      await this.runOnce(workspacePath, 'npm', ['install'], 10 * 60_000)
    }
    const port = await findAvailablePort(4000)
    const detected = detectDevCommand(workspacePath, port)
    if (!detected) throw new Error('no dev command detected')
    const env = { ...process.env, PORT: String(port) }
    const proc = spawn(detected.command, detected.args, {
      cwd: workspacePath,
      env,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const info: DevServerInfo = {
      projectId,
      port,
      url: `http://127.0.0.1:${port}`,
      status: 'starting',
      command: `${detected.command} ${detected.args.join(' ')}`,
      logs: [],
    }
    const rec: ProcessRec = { proc, info, workspacePath }
    this.rec.set(projectId, rec)
    this.emit('status', info)
    this.emit('log', { projectId, line: `$ cd ${workspacePath}` })
    this.emit('log', { projectId, line: `$ ${info.command}` })

    const onLine = (raw: string) => {
      const lines = raw.toString().split(/\r?\n/).filter(Boolean)
      for (const ln of lines) {
        info.logs.push(ln)
        if (info.logs.length > 500) info.logs.splice(0, info.logs.length - 500)
        // Stream live to subscribers (UI bottom terminal)
        this.emit('log', { projectId, line: ln })
      }
    }
    proc.stdout?.on('data', onLine)
    proc.stderr?.on('data', onLine)
    proc.on('exit', (code) => {
      info.status = code === 0 ? 'stopped' : 'failed'
      this.emit('log', { projectId, line: `[devserver] process exited with code ${code}` })
      this.emit('status', info)
      this.rec.delete(projectId)
    })

    // Robust readiness: poll the port with a real TCP connect every 500ms.
    // This is the only reliable signal that the server actually accepts connections.
    // Stop polling once ready, on timeout (90s), or on process exit.
    const probeStart = Date.now()
    const probe = setInterval(async () => {
      if (info.status !== 'starting') { clearInterval(probe); return }
      if (Date.now() - probeStart > 90_000) {
        clearInterval(probe)
        info.status = 'failed'
        this.emit('log', { projectId, line: '[devserver] timed out waiting for port to accept connections (90s)' })
        this.emit('status', info)
        return
      }
      const ok = await canConnect('127.0.0.1', port, 500)
      if (ok) {
        clearInterval(probe)
        info.status = 'ready'
        this.emit('log', { projectId, line: `[devserver] ✓ port ${port} accepting connections — preview live at ${info.url}` })
        this.emit('status', info)
      }
    }, 500)
    return info
  }

  async stop(projectId: string): Promise<void> {
    const rec = this.rec.get(projectId)
    if (!rec) return
    const pid = rec.proc.pid
    const groupKill = (sig: NodeJS.Signals) => {
      try { process.kill(-pid, sig) } catch {
        try { rec.proc.kill(sig) } catch {}
      }
    }
    groupKill('SIGTERM')
    await new Promise((r) => setTimeout(r, 800))
    groupKill('SIGKILL')
    // Belt and suspenders: free port via fuser if available
    try { spawn('fuser', ['-k', `${rec.info.port}/tcp`], { stdio: 'ignore' }).unref() } catch {}
    clearStaleDevLocks(rec.workspacePath)
    rec.info.status = 'stopped'
    this.emit('status', rec.info)
    this.rec.delete(projectId)
  }

  private runOnce(cwd: string, cmd: string, args: string[], timeoutMs: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(cmd, args, { cwd, stdio: 'inherit' })
      const t = setTimeout(() => { try { child.kill('SIGKILL') } catch {}; reject(new Error(`${cmd} timeout`)) }, timeoutMs)
      child.on('exit', (code) => { clearTimeout(t); code === 0 ? resolve() : reject(new Error(`${cmd} exit ${code}`)) })
      child.on('error', (err) => { clearTimeout(t); reject(err) })
    })
  }
}

export const devServerManager = new DevServerManager()
export type { DevServerInfo }
