import { spawn, ChildProcess } from 'child_process'
import { createServer, createConnection } from 'net'
import fs from 'fs'
import path from 'path'

export interface DevServerInfo {
  projectId: string
  port: number
  url: string
  status: 'starting' | 'ready' | 'error' | 'stopped'
  pid?: number
  error?: string
  startedAt: string
}

type StatusListener = (info: DevServerInfo) => void
type LogListener   = (projectId: string, line: string) => void

function findAvailablePort(start = 4000): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(start, '127.0.0.1', () => {
      const addr = server.address() as { port: number }
      server.close(() => resolve(addr.port))
    })
    server.on('error', () => findAvailablePort(start + 1).then(resolve).catch(reject))
  })
}

/** Poll until something is actually listening on the port (connect succeeds) */
function waitForPort(port: number, timeout = 90_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeout
    function attempt() {
      const sock = createConnection({ port, host: '127.0.0.1' })
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => {
        sock.destroy()
        if (Date.now() > deadline) {
          reject(new Error(`Dev server did not start within ${timeout / 1000}s`))
        } else {
          setTimeout(attempt, 800)
        }
      })
    }
    attempt()
  })
}

/** Detect which dev command to run based on workspace contents */
function detectDevCommand(workspacePath: string): { cmd: string; args: string[] } | null {
  const pkgPath = path.join(workspacePath, 'package.json')
  if (!fs.existsSync(pkgPath)) return null
  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as {
      scripts?: Record<string, string>
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const scripts = pkg.scripts ?? {}
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (scripts.dev)   return { cmd: 'npm', args: ['run', 'dev'] }
    if (scripts.start) return { cmd: 'npm', args: ['start'] }
    if (scripts.serve) return { cmd: 'npm', args: ['run', 'serve'] }
    if (deps['next'])            return { cmd: 'npx', args: ['next', 'dev'] }
    if (deps['vite'])            return { cmd: 'npx', args: ['vite'] }
    if (deps['react-scripts'])   return { cmd: 'npx', args: ['react-scripts', 'start'] }
    if (deps['@sveltejs/kit'])   return { cmd: 'npx', args: ['vite', 'dev'] }
    if (deps['nuxt'])            return { cmd: 'npx', args: ['nuxt', 'dev'] }
    return null
  } catch {
    return null
  }
}

/** Run npm install asynchronously, streaming output to logFn */
function npmInstall(workspacePath: string, logFn: (line: string) => void): Promise<void> {
  return new Promise((resolve) => {
    logFn('[devserver] Running npm install...')
    const proc = spawn('npm', ['install', '--prefer-offline'], {
      cwd: workspacePath,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const emit = (d: Buffer) => {
      for (const line of d.toString().split(/\r?\n/)) {
        if (line.trim()) logFn(`[npm] ${line}`)
      }
    }
    proc.stdout?.on('data', emit)
    proc.stderr?.on('data', emit)
    proc.on('close', (code) => {
      logFn(`[devserver] npm install finished (exit ${code ?? '?'})`)
      resolve() // continue regardless — maybe it's already installed
    })
    proc.on('error', (e) => {
      logFn(`[devserver] npm install error: ${e.message}`)
      resolve()
    })
  })
}

class DevServerManager {
  private servers  = new Map<string, { proc: ChildProcess; info: DevServerInfo }>()
  private statusListeners: StatusListener[] = []
  private logListeners:    LogListener[]    = []

  onStatus(fn: StatusListener) { this.statusListeners.push(fn) }
  onLog   (fn: LogListener)    { this.logListeners.push(fn) }

  private emitStatus(info: DevServerInfo) {
    this.statusListeners.forEach((fn) => fn(info))
  }
  private emitLog(projectId: string, line: string) {
    this.logListeners.forEach((fn) => fn(projectId, line))
  }

  getStatus(projectId: string): DevServerInfo | null {
    return this.servers.get(projectId)?.info ?? null
  }

  async start(projectId: string, workspacePath: string): Promise<DevServerInfo> {
    this.stop(projectId)

    const log = (line: string) => this.emitLog(projectId, line)

    if (!fs.existsSync(workspacePath)) {
      const info: DevServerInfo = { projectId, port: 0, url: '', status: 'error', error: 'Workspace directory does not exist', startedAt: new Date().toISOString() }
      this.emitStatus(info)
      return info
    }

    const devCmd = detectDevCommand(workspacePath)
    if (!devCmd) {
      const info: DevServerInfo = { projectId, port: 0, url: '', status: 'error', error: 'No runnable project detected (no package.json with dev/start script)', startedAt: new Date().toISOString() }
      this.emitStatus(info)
      return info
    }

    // Install deps if node_modules missing
    const nmPath = path.join(workspacePath, 'node_modules')
    if (!fs.existsSync(nmPath) && fs.existsSync(path.join(workspacePath, 'package.json'))) {
      await npmInstall(workspacePath, log)
    }

    const port = await findAvailablePort(4000)
    const url  = `http://localhost:${port}`
    const info: DevServerInfo = { projectId, port, url, status: 'starting', startedAt: new Date().toISOString() }
    this.emitStatus({ ...info })
    log(`[devserver] Starting on port ${port}: ${devCmd.cmd} ${devCmd.args.join(' ')}`)

    const proc = spawn(devCmd.cmd, devCmd.args, {
      cwd: workspacePath,
      env: { ...process.env, PORT: String(port), NEXT_PUBLIC_URL: url },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    info.pid = proc.pid

    const emitLine = (d: Buffer) => {
      for (const line of d.toString().split(/\r?\n/)) {
        if (line.trim()) log(`[dev] ${line}`)
      }
    }
    proc.stdout?.on('data', emitLine)
    proc.stderr?.on('data', emitLine)

    proc.on('error', (err) => {
      log(`[devserver] process error: ${err.message}`)
      info.status = 'error'
      info.error  = err.message
      this.emitStatus({ ...info })
    })

    proc.on('close', (code) => {
      log(`[devserver] process exited (code ${code ?? '?'})`)
      info.status = 'stopped'
      this.servers.delete(projectId)
      this.emitStatus({ ...info })
    })

    this.servers.set(projectId, { proc, info })

    // Wait for port to become active
    try {
      await waitForPort(port, 90_000)
      info.status = 'ready'
      log(`[devserver] Ready at ${url}`)
      this.emitStatus({ ...info })
    } catch (err) {
      info.status = 'error'
      info.error  = err instanceof Error ? err.message : 'Timeout'
      log(`[devserver] ${info.error}`)
      this.emitStatus({ ...info })
    }

    return { ...info }
  }

  stop(projectId: string) {
    const entry = this.servers.get(projectId)
    if (!entry) return
    this.emitLog(projectId, '[devserver] Stopping...')
    try {
      entry.proc.kill('SIGTERM')
      setTimeout(() => { try { entry.proc.kill('SIGKILL') } catch {} }, 3000)
    } catch {}
    this.servers.delete(projectId)
    this.emitStatus({ ...entry.info, status: 'stopped' })
  }

  stopAll() {
    for (const id of Array.from(this.servers.keys())) this.stop(id)
  }
}

const g = globalThis as typeof globalThis & { __openlinaDevServerManager?: DevServerManager }
if (!g.__openlinaDevServerManager) g.__openlinaDevServerManager = new DevServerManager()
export const devServerManager = g.__openlinaDevServerManager
