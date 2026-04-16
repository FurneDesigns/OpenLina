import type { Server as HTTPServer } from 'http'
import { Server as SocketServer, Namespace } from 'socket.io'
import { ptyManager } from '../lib/terminal/PtyManager'
import { messageBus } from '../lib/agents/MessageBus'
import { agentRegistry } from '../lib/agents/AgentRegistry'
import { invokeWithFailover } from '../lib/llm/failover'
import { getDb } from '../lib/db'
import { PipelineRunner, pipelineRegistry } from '../lib/pipeline/PipelineRunner'
import { devServerManager } from '../lib/devserver/DevServerManager'
import type { Agent, AgentEdge, AgentPosition } from '@/types/agent'

// node:sqlite returns raw snake_case column names — map to camelCase Agent shape
function rowToAgent(row: Record<string, unknown>): Agent {
  return {
    id:           row.id as string,
    projectId:    row.project_id as string | undefined,
    name:         row.name as string,
    description:  row.description as string | undefined,
    llmConfigId:  row.llm_config_id as string | undefined,
    systemPrompt: (row.system_prompt as string) ?? '',
    tools:        row.tools ? JSON.parse(row.tools as string) : [],
    canvasX:      Number(row.canvas_x ?? 100),
    canvasY:      Number(row.canvas_y ?? 100),
    status:       (row.status as Agent['status']) ?? 'idle',
    color:        (row.color as string) ?? '#6366f1',
    createdAt:    row.created_at as string,
    updatedAt:    row.updated_at as string,
  }
}

function rowToEdge(row: Record<string, unknown>): AgentEdge {
  return {
    id:        row.id as string,
    sourceId:  row.source_id as string,
    targetId:  row.target_id as string,
    label:     row.label as string | undefined,
    edgeType:  (row.edge_type as AgentEdge['edgeType']) ?? 'default',
    createdAt: row.created_at as string,
  }
}

let io: SocketServer | null = null

export function initSocketServer(httpServer: HTTPServer): SocketServer {
  if (io) return io

  io = new SocketServer(httpServer, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  })

  // ─── /terminal ───────────────────────────────────────────────────────────────
  const terminalNs = io.of('/terminal')
  terminalNs.on('connection', (socket) => {
    socket.on('session:create', ({ sessionId, command, cwd, cols, rows }) => {
      if (ptyManager.has(sessionId)) return
      ptyManager.create({
        sessionId,
        command,
        cwd,
        cols,
        rows,
        onData: (data) => socket.emit('terminal:output', { sessionId, data }),
        onExit: (exitCode) => socket.emit('terminal:exit', { sessionId, exitCode }),
      })
    })

    socket.on('session:input', ({ sessionId, data }) => {
      ptyManager.write(sessionId, data)
    })

    socket.on('session:resize', ({ sessionId, cols, rows }) => {
      ptyManager.resize(sessionId, cols, rows)
    })

    socket.on('session:kill', ({ sessionId }) => {
      ptyManager.kill(sessionId)
    })

    socket.on('disconnect', () => {
      // Sessions persist across reconnects; client manages cleanup via session:kill
    })
  })

  // ─── /agents ─────────────────────────────────────────────────────────────────
  const agentsNs = io.of('/agents')

  // Wire agent status changes and failover events to all connected clients
  agentRegistry.onStatus((agentId, status) => {
    agentsNs.emit('agent:status', { agentId, status })
  })

  agentRegistry.onFailover((event) => {
    io?.of('/llm').emit('llm:failover', event)
  })

  // Wire the message bus to broadcast messages to subscribed sockets
  messageBus.on('message', (msg) => {
    agentsNs.emit('agent:message', msg)
  })

  agentsNs.on('connection', (socket) => {
    // Send full canvas state on connect
    const db = getDb()
    const agents = (db.prepare('SELECT * FROM agents').all() as Record<string, unknown>[]).map(rowToAgent)
    const edges  = (db.prepare('SELECT * FROM agent_edges').all() as Record<string, unknown>[]).map(rowToEdge)
    socket.emit('canvas:synced', { agents, edges })

    socket.on('agent:subscribe', ({ agentId }) => {
      socket.join(`agent:${agentId}`)
    })

    socket.on('agent:unsubscribe', ({ agentId }) => {
      socket.leave(`agent:${agentId}`)
    })

    socket.on('agent:send', ({ fromAgentId, toAgentId, content, role }) => {
      messageBus.publish({ fromAgentId: fromAgentId ?? undefined, toAgentId, content, role })
    })

    socket.on('agent:broadcast', ({ fromAgentId, content }) => {
      messageBus.publish({ fromAgentId, content, role: 'assistant' })
    })

    socket.on('agent:run', async ({ agentId, prompt }) => {
      try {
        await agentRegistry.run(agentId, prompt)
      } catch (err) {
        socket.emit('agent:error', {
          agentId,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    })

    socket.on('agent:cancel', ({ agentId }) => {
      agentRegistry.cancel(agentId)
    })

    socket.on('canvas:update', ({ agents: positions, edges }: { agents: AgentPosition[]; edges: AgentEdge[] }) => { try {
      const db = getDb()
      const updatePos = db.prepare(
        "UPDATE agents SET canvas_x = ?, canvas_y = ?, updated_at = datetime('now') WHERE id = ?"
      )
      for (const pos of positions) {
        if (!pos.id) continue
        const x = Number.isFinite(pos.canvasX) ? pos.canvasX : 100
        const y = Number.isFinite(pos.canvasY) ? pos.canvasY : 100
        try {
          updatePos.run(x, y, pos.id)
        } catch {
          // ignore individual position update failures
        }
      }

      // Upsert edges when provided
      if (Array.isArray(edges) && edges.length > 0) {
        const upsertEdge = db.prepare(`
          INSERT INTO agent_edges (id, source_id, target_id, label, edge_type)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            label     = excluded.label,
            edge_type = excluded.edge_type
        `)
        for (const edge of edges) {
          if (!edge.id || !edge.sourceId || !edge.targetId) continue
          upsertEdge.run(
            edge.id,
            edge.sourceId,
            edge.targetId,
            edge.label ?? null,
            edge.edgeType ?? 'default',
          )
        }
      }

      // Broadcast updated canvas to all other clients
      socket.broadcast.emit('canvas:synced', { agents: positions, edges })
    } catch (err) {
      console.error('[canvas:update] error:', err)
    } })
  })

  // ─── /llm ────────────────────────────────────────────────────────────────────
  const llmNs = io.of('/llm')

  llmNs.on('connection', (socket) => {
    socket.on('llm:invoke', async ({ requestId, messages, agentId }) => {
      try {
        const response = await invokeWithFailover(messages, {
          requestId,
          agentId,
          onFailover: (event) => {
            socket.emit('llm:failover', event)
          },
        })
        socket.emit('llm:response', {
          requestId,
          content: response.content,
          llmConfigId: response.llmConfigId,
          usage: response.usage,
        })
      } catch (err) {
        socket.emit('llm:error', {
          requestId,
          message: err instanceof Error ? err.message : 'LLM invocation failed',
        })
      }
    })
  })

  // ─── /pipeline ───────────────────────────────────────────────────────────────
  const pipelineNs = io.of('/pipeline')

  // Wire devServerManager events → all pipeline clients (global, not run-scoped)
  devServerManager.onStatus((info) => {
    pipelineNs.emit('devserver:status', info)
  })
  devServerManager.onLog((projectId, line) => {
    pipelineNs.emit('devserver:log', { projectId, line })
  })

  pipelineNs.on('connection', (socket) => {
    socket.on('pipeline:start', async ({ projectId, maxIterations = 3 }) => {
      const runner = new PipelineRunner()

      // Wire all events → socket
      // Track which pipeline steps have an associated PTY session
      const stepToSession = new Map<string, string>()

      runner.on('run_created',     (runId, pid, maxIter)               => { socket.join(`run:${runId}`); pipelineNs.to(`run:${runId}`).emit('pipeline:run_created',     { runId, projectId: pid, maxIterations: maxIter }) })
      runner.on('iteration_start', (runId, iteration)                   => pipelineNs.to(`run:${runId}`).emit('pipeline:iteration_start',   { runId, iteration }))
      runner.on('agent_start',     (runId, stepId, agentId, name, role, iteration, sessionId) => {
        if (sessionId) {
          stepToSession.set(stepId, sessionId)
          // Bridge PTY data → /terminal namespace so BottomTerminal tabs receive it
          ptyManager.addDataListener(sessionId, (data) => {
            terminalNs.emit('terminal:output', { sessionId, data })
          })
        }
        pipelineNs.to(`run:${runId}`).emit('pipeline:agent_start', { runId, stepId, agentId, agentName: name, role, iteration, sessionId })
      })
      runner.on('agent_chunk',     (runId, stepId, delta)               => pipelineNs.to(`run:${runId}`).emit('pipeline:agent_chunk',        { runId, stepId, delta }))
      runner.on('agent_complete',  (runId, stepId, output, tokensUsed, modelLabel, providerType) => {
        stepToSession.delete(stepId)
        pipelineNs.to(`run:${runId}`).emit('pipeline:agent_complete', { runId, stepId, output, tokensUsed, modelLabel, providerType })
      })
      runner.on('agent_error',     (runId, stepId, message)             => pipelineNs.to(`run:${runId}`).emit('pipeline:agent_error',        { runId, stepId, message }))
      runner.on('qa_verdict',      (runId, iteration, passed, issues)   => pipelineNs.to(`run:${runId}`).emit('pipeline:qa_verdict',         { runId, iteration, passed, issues }))
      runner.on('files_written',   (runId, files)                       => pipelineNs.to(`run:${runId}`).emit('pipeline:files_written',      { runId, files }))
      runner.on('run_complete', (runId, status, iterations) => {
        pipelineNs.to(`run:${runId}`).emit('pipeline:run_complete', { runId, status, iterations })
        pipelineRegistry.delete(runId)
        // Auto-start dev server when pipeline succeeds
        if (status === 'completed') {
          const db = getDb()
          const proj = db.prepare('SELECT id, workspace_path FROM projects WHERE id = ?').get(projectId) as
            { id: string; workspace_path: string } | undefined
          if (proj?.workspace_path) {
            devServerManager.start(proj.id, proj.workspace_path).then((info) => {
              pipelineNs.to(`run:${runId}`).emit('devserver:status', info)
            }).catch(() => {})
          }
        }
      })

      // Start the pipeline (non-blocking)
      runner.run(projectId, maxIterations).catch((err) => {
        console.error('[pipeline] uncaught error:', err)
      })

      // Register immediately once run() has assigned the id so STOP can find the runner.
      if (runner.runId) pipelineRegistry.add(runner)
    })

    socket.on('pipeline:stop', ({ runId }) => {
      pipelineRegistry.get(runId)?.stop()
    })

    socket.on('pipeline:subscribe', ({ runId }) => {
      socket.join(`run:${runId}`)
    })

    socket.on('devserver:start', async ({ projectId }) => {
      const db = getDb()
      const proj = db.prepare('SELECT id, workspace_path FROM projects WHERE id = ? OR slug = ?').get(projectId, projectId) as
        { id: string; workspace_path: string } | undefined
      if (!proj?.workspace_path) {
        socket.emit('devserver:status', { status: 'error', error: 'Project not found' })
        return
      }
      socket.emit('devserver:status', { projectId: proj.id, status: 'starting' })
      const info = await devServerManager.start(proj.id, proj.workspace_path).catch((e) =>
        ({ projectId: proj.id, port: 0, url: '', status: 'error' as const, error: String(e), startedAt: new Date().toISOString() })
      )
      socket.emit('devserver:status', info)
    })

    // Prepare: allocate a port and detect dev command without spawning.
    // The client will run the actual command in the bottom terminal.
    socket.on('devserver:prepare', async ({ projectId }) => {
      const db = getDb()
      const proj = db.prepare('SELECT id, workspace_path FROM projects WHERE id = ? OR slug = ?').get(projectId, projectId) as
        { id: string; workspace_path: string } | undefined
      if (!proj?.workspace_path) {
        socket.emit('devserver:prepared', { error: 'Project not found' })
        return
      }
      try {
        const { createServer } = await import('net')
        const port: number = await new Promise((resolve, reject) => {
          let p = 4000
          const tryPort = () => {
            const s = createServer()
            s.listen(p, '127.0.0.1', () => { s.close(() => resolve(p)) })
            s.on('error', () => { p++; if (p > 4100) reject(new Error('no free port')); else tryPort() })
          }
          tryPort()
        })
        // Detect dev command from package.json
        const { default: fs } = await import('fs')
        const { default: path } = await import('path')
        let devCmd = 'npm run dev'
        const pkgPath = path.join(proj.workspace_path, 'package.json')
        if (fs.existsSync(pkgPath)) {
          try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> }
            if (pkg.scripts?.dev) devCmd = 'npm run dev'
            else if (pkg.scripts?.start) devCmd = 'npm start'
            else if (pkg.scripts?.serve) devCmd = 'npm run serve'
          } catch { /* use default */ }
        }
        socket.emit('devserver:prepared', { projectId: proj.id, port, command: devCmd, workspacePath: proj.workspace_path })
        // Watch port in background and emit ready when it opens
        const { createConnection } = await import('net')
        const deadline = Date.now() + 120_000
        const watch = () => {
          const sock = createConnection({ port, host: '127.0.0.1' })
          sock.once('connect', () => {
            sock.destroy()
            pipelineNs.emit('devserver:status', { projectId: proj.id, port, url: `http://localhost:${port}`, status: 'ready', startedAt: new Date().toISOString() })
          })
          sock.once('error', () => {
            sock.destroy()
            if (Date.now() < deadline) setTimeout(watch, 800)
            else pipelineNs.emit('devserver:status', { projectId: proj.id, port, url: '', status: 'error', error: 'Timeout waiting for dev server', startedAt: new Date().toISOString() })
          })
        }
        watch()
      } catch (e) {
        socket.emit('devserver:prepared', { error: String(e) })
      }
    })

    socket.on('devserver:stop', ({ projectId }) => {
      devServerManager.stop(projectId)
      socket.emit('devserver:status', { projectId, status: 'stopped' })
    })

    socket.on('devserver:status', ({ projectId }) => {
      const info = devServerManager.getStatus(projectId)
      socket.emit('devserver:status', info ?? { projectId, status: 'stopped' })
    })
  })

  return io
}

export function getSocketServer(): SocketServer | null {
  return io
}

export function broadcastLLMQueueUpdate(): void {
  if (!io) return
  const db = getDb()
  const queue = db
    .prepare('SELECT id, label, model_id, platform_id, priority, enabled FROM llm_configs ORDER BY priority ASC')
    .all()
  io.of('/llm').emit('llm:queue-updated', { queue })
}
