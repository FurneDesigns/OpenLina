// node-pty wrapper with process-group kill semantics.
type IPty = any
type DataListener = (data: string) => void
type ExitListener = (code: number) => void

interface SpawnOpts {
  sessionId: string
  command: string
  args?: string[]
  cwd?: string
  env?: NodeJS.ProcessEnv
  cols?: number
  rows?: number
}

interface SessionRecord {
  pty: IPty
  dataListeners: Set<DataListener>
  exitListeners: Set<ExitListener>
  buffer: string  // small ring buffer for late subscribers
}

const RING_CAP = 32_000

class PtyManager {
  private sessions = new Map<string, SessionRecord>()
  // Subscribers attached BEFORE the session was spawned. Wired up when spawn() runs.
  private pendingData = new Map<string, Set<DataListener>>()
  private pendingExit = new Map<string, Set<ExitListener>>()

  async spawn(opts: SpawnOpts): Promise<{ sessionId: string }> {
    if (this.sessions.has(opts.sessionId)) {
      throw new Error(`pty session already exists: ${opts.sessionId}`)
    }
    let pty: any
    try {
      pty = require('node-pty')
    } catch (err) {
      throw new Error('node-pty is not installed. Run `npm install` first.')
    }
    const child = pty.spawn(opts.command, opts.args || [], {
      name: 'xterm-color',
      cols: opts.cols ?? 120,
      rows: opts.rows ?? 32,
      cwd: opts.cwd,
      env: opts.env || process.env,
    })
    const rec: SessionRecord = {
      pty: child,
      dataListeners: new Set(),
      exitListeners: new Set(),
      buffer: '',
    }
    this.sessions.set(opts.sessionId, rec)
    // Hook up any listeners that subscribed before this session existed
    const pendD = this.pendingData.get(opts.sessionId)
    if (pendD) { for (const l of pendD) rec.dataListeners.add(l); this.pendingData.delete(opts.sessionId) }
    const pendE = this.pendingExit.get(opts.sessionId)
    if (pendE) { for (const l of pendE) rec.exitListeners.add(l); this.pendingExit.delete(opts.sessionId) }

    child.onData((data: string) => {
      rec.buffer = (rec.buffer + data).slice(-RING_CAP)
      for (const l of rec.dataListeners) {
        try { l(data) } catch {}
      }
    })
    child.onExit(({ exitCode }: { exitCode: number }) => {
      for (const l of rec.exitListeners) {
        try { l(exitCode) } catch {}
      }
      // keep record around briefly so subscribers can still read buffer
      setTimeout(() => this.sessions.delete(opts.sessionId), 1_000)
    })
    return { sessionId: opts.sessionId }
  }

  onData(sessionId: string, listener: DataListener): () => void {
    const rec = this.sessions.get(sessionId)
    if (rec) {
      if (rec.buffer) { try { listener(rec.buffer) } catch {} }
      rec.dataListeners.add(listener)
      return () => rec.dataListeners.delete(listener)
    }
    let bag = this.pendingData.get(sessionId)
    if (!bag) { bag = new Set(); this.pendingData.set(sessionId, bag) }
    bag.add(listener)
    return () => bag!.delete(listener)
  }

  onExit(sessionId: string, listener: ExitListener): () => void {
    const rec = this.sessions.get(sessionId)
    if (rec) { rec.exitListeners.add(listener); return () => rec.exitListeners.delete(listener) }
    let bag = this.pendingExit.get(sessionId)
    if (!bag) { bag = new Set(); this.pendingExit.set(sessionId, bag) }
    bag.add(listener)
    return () => bag!.delete(listener)
  }

  write(sessionId: string, data: string): void {
    const rec = this.sessions.get(sessionId)
    if (!rec) return
    try { rec.pty.write(data) } catch (err: any) {
      if (err && err.code === 'EBADF') return
      throw err
    }
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const rec = this.sessions.get(sessionId)
    if (!rec) return
    try { rec.pty.resize(cols, rows) } catch (err: any) {
      if (err && err.code === 'EBADF') return
      throw err
    }
  }

  list(): string[] {
    return Array.from(this.sessions.keys())
  }

  /**
   * Kill the entire process group (so subprocesses spawned by the CLI also die).
   * SIGTERM, then SIGKILL after 600ms.
   */
  kill(sessionId: string): void {
    const rec = this.sessions.get(sessionId)
    if (!rec) return
    const pid = rec.pty.pid
    const groupKill = (sig: NodeJS.Signals) => {
      try { process.kill(-pid, sig) } catch (err: any) {
        if (err?.code !== 'ESRCH') {
          // fallback to leader kill
          try { rec.pty.kill(sig) } catch {}
        }
      }
    }
    groupKill('SIGTERM')
    setTimeout(() => groupKill('SIGKILL'), 600)
  }

  killAll(): void {
    for (const id of Array.from(this.sessions.keys())) this.kill(id)
  }
}

export const ptyManager = new PtyManager()
export type { PtyManager }
