import * as pty from 'node-pty'
import os from 'os'

interface Session {
  pty: pty.IPty
  sessionId: string
  onData: (data: string) => void
  onExit: (code: number) => void
}

type DataListener = (data: string) => void

class PtyManager {
  private sessions = new Map<string, Session>()
  // External listeners per session (e.g. socket.ts bridges PTY → terminal ns)
  private dataListeners = new Map<string, Set<DataListener>>()

  create(opts: {
    sessionId: string
    command?: string
    cwd?: string
    cols: number
    rows: number
    onData: (data: string) => void
    onExit: (exitCode: number) => void
  }): void {
    const shell = opts.command ?? (os.platform() === 'win32' ? 'cmd.exe' : (process.env.SHELL ?? '/bin/bash'))
    const cwd = opts.cwd ?? os.homedir()

    const proc = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: opts.cols,
      rows: opts.rows,
      cwd,
      env: { ...process.env } as Record<string, string>,
    })

    proc.onData((data) => {
      opts.onData(data)
      this.dataListeners.get(opts.sessionId)?.forEach((fn) => fn(data))
    })
    proc.onExit(({ exitCode }) => {
      this.sessions.delete(opts.sessionId)
      this.dataListeners.delete(opts.sessionId)
      opts.onExit(exitCode ?? 0)
    })

    this.sessions.set(opts.sessionId, {
      pty: proc,
      sessionId: opts.sessionId,
      onData: opts.onData,
      onExit: opts.onExit,
    })
  }

  /**
   * Spawn a command directly as a PTY process (not inside bash).
   * Resolves with full raw output when the process exits.
   * The session stays in `this.sessions` so the terminal namespace can route
   * user keystrokes to the process (e.g. answering yes/no prompts).
   */
  runCommand(opts: {
    sessionId: string
    command: string
    args: string[]
    cwd: string
    env?: Record<string, string>
    cols?: number
    rows?: number
    onData?: (data: string) => void
  }): Promise<string> {
    return new Promise((resolve, reject) => {
      let fullOutput = ''

      let proc: pty.IPty
      try {
        proc = pty.spawn(opts.command, opts.args, {
          name: 'xterm-256color',
          cols: opts.cols ?? 120,
          rows: opts.rows ?? 15,
          cwd: opts.cwd,
          env: { ...process.env, ...opts.env } as Record<string, string>,
        })
      } catch (err) {
        reject(err)
        return
      }

      proc.onData((data) => {
        fullOutput += data
        opts.onData?.(data)
        this.dataListeners.get(opts.sessionId)?.forEach((fn) => fn(data))
      })

      proc.onExit(({ exitCode }) => {
        this.sessions.delete(opts.sessionId)
        this.dataListeners.delete(opts.sessionId)
        // Resolve even on non-zero exit — caller inspects output
        resolve(fullOutput)
      })

      this.sessions.set(opts.sessionId, {
        pty: proc,
        sessionId: opts.sessionId,
        onData: opts.onData ?? (() => {}),
        onExit: () => {},
      })
    })
  }

  /** Add a listener that fires for every data event on a session */
  addDataListener(sessionId: string, fn: DataListener): void {
    if (!this.dataListeners.has(sessionId)) this.dataListeners.set(sessionId, new Set())
    this.dataListeners.get(sessionId)!.add(fn)
  }

  removeDataListener(sessionId: string, fn: DataListener): void {
    this.dataListeners.get(sessionId)?.delete(fn)
  }

  write(sessionId: string, data: string): void {
    this.sessions.get(sessionId)?.pty.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.sessions.get(sessionId)?.pty.resize(cols, rows)
  }

  kill(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.pty.kill()
      this.sessions.delete(sessionId)
      this.dataListeners.delete(sessionId)
    }
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId)
  }
}

export const ptyManager = new PtyManager()
