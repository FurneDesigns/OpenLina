import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { getDb, genId, nowIso, safeJsonParse } from '../db'
import { buildAdaptersFromDb } from '../llm/registry'
import { invokeWithFailover } from '../llm/failover'
import { pickFirstHealthyAdapter, clearHealthCache } from '../llm/cli-health'
import { validateAndFixModelId } from '../llm/model-validator'
import { prepareCliBeforeRun } from '../llm/cli-setup'
import { runVerificationChecks, formatReportForPrompt, clearVerificationCache, type VerificationReport } from './verification'
import { REVIEWER_DEFAULT_PROMPT, buildReviewerUserPrompt, parseReviewVerdict } from './reviewPrompt'
import { getScaffoldCommand } from './scaffoldCommands'
import { ptyManager } from '../terminal/PtyManager'
import { devServerManager } from '../devserver/DevServerManager'
import { indexSource, search as searchEmbeddings } from '../embeddings/index'
import type { ChatMessage, LLMAdapter } from '../llm/types'

export type AgentRoleKind = 'worker' | 'reviewer'

export interface AgentRow {
  id: string
  project_id: string
  name: string
  role: string | null
  responsibilities: string | null
  system_prompt: string | null
  execution_order: number
  max_iterations: number
  status: string | null
  role_kind: AgentRoleKind
  reviews_agent_id: string | null
}

export interface ProjectRow {
  id: string
  name: string
  slug: string | null
  description: string | null
  project_type: string | null
  framework: string | null
  target_audience: string | null
  key_features: string | null
  tech_stack: string | null
  brand_colors: string | null
  deployment_target: string | null
  workspace_path: string
  target_llm_config_id: string | null
}

const PLANNING_ROLES = new Set(['ceo', 'pm'])
const ARCHITECT_ROLES = new Set(['architect'])
const WRITING_ROLES = new Set(['designer', 'dev', 'devops', 'fullstack'])
const VERIFY_BEFORE_ROLES = new Set(['qa'])
const VERIFY_REVIEWER_OF_ROLES = new Set(['dev', 'fullstack', 'devops', 'designer'])

const ROLE_ORDER = ['ceo', 'pm', 'architect', 'designer', 'dev', 'fullstack', 'backend', 'frontend', 'devops', 'reviewer', 'qa']

const PER_STEP_CAP = 2_500
const RAW_OUTPUT_CAP = 60_000
const PLAN_CAP = 6_000

export interface RunEvents {
  run_created: { runId: string; projectId: string; maxIterations: number }
  iteration_start: { runId: string; iteration: number }
  agent_start: { runId: string; stepId: string; agentId: string; name: string; role: string; iteration: number; sessionId?: string }
  agent_chunk: { runId: string; stepId: string; delta: string }
  agent_complete: { runId: string; stepId: string; output: string; tokens?: number; modelLabel?: string; providerType: string }
  agent_error: { runId: string; stepId: string; message: string }
  agent_artifact: { runId: string; stepId: string; iteration: number; role: string; name: string; relativePath: string; absolutePath: string }
  qa_verdict: { runId: string; iteration: number; passed: boolean; issues?: string }
  review_verdict: { runId: string; reviewerStepId: string; workerStepId: string; verdict: 'approve' | 'request_changes'; feedback: string; attempt: number }
  files_written: { runId: string; files: string[] }
  run_complete: { runId: string; status: 'completed' | 'failed' | 'stopped'; iterations: number }
}

interface ResumeState {
  startIteration: number
  completedAgentIds: Set<string>
  planningContext: string
  iterationOutputs: Record<string, string>
  prevQaIssues: string
}

export class PipelineRunner extends EventEmitter {
  private stopped = false
  private activeSessions = new Set<string>()
  private activeChildren = new Set<any>()
  private currentRunId: string | null = null

  emitTyped<K extends keyof RunEvents>(event: K, payload: RunEvents[K]): void {
    this.emit(event, payload)
  }

  async start(projectId: string, maxIterations: number): Promise<string> {
    const runId = await this.runInner(projectId, maxIterations)
    return runId
  }

  async resume(runId: string): Promise<void> {
    const db = getDb()
    const run = db.prepare(`SELECT * FROM project_runs WHERE id = ?`).get(runId) as any
    if (!run) throw new Error(`run not found: ${runId}`)
    const steps = db.prepare(`SELECT * FROM run_steps WHERE run_id = ? ORDER BY created_at ASC`).all(runId) as any[]
    const completed = steps.filter((s) => s.status === 'completed')
    const startIteration = completed.length ? Math.max(1, ...completed.map((s) => s.iteration)) : 1
    const completedAgentIds = new Set<string>(completed.filter((s) => s.iteration === startIteration).map((s) => s.agent_id))
    const planningContext = completed
      .filter((s) => PLANNING_ROLES.has((s.role || '').toLowerCase()))
      .map((s) => s.output || '')
      .join('\n\n')
      .slice(0, PLAN_CAP)
    const iterationOutputs: Record<string, string> = {}
    for (const s of completed.filter((c) => c.iteration === startIteration)) {
      iterationOutputs[s.role || s.agent_id] = (s.output || '').slice(0, PER_STEP_CAP)
    }
    const lastQa = [...completed].reverse().find((s) => (s.role || '').toLowerCase() === 'qa')
    const prevQaIssues = lastQa?.verdict === 'request_changes' ? (lastQa.output || '').slice(0, PER_STEP_CAP) : ''
    db.prepare(`UPDATE project_runs SET status = 'running', completed_at = NULL WHERE id = ?`).run(runId)
    await this.runInner(run.project_id, run.max_iterations, {
      startIteration,
      completedAgentIds,
      planningContext,
      iterationOutputs,
      prevQaIssues,
    }, runId)
  }

  stop(): void {
    this.stopped = true
    for (const s of Array.from(this.activeSessions)) {
      try { ptyManager.kill(s) } catch {}
    }
    this.activeSessions.clear()
    for (const child of Array.from(this.activeChildren)) {
      try {
        const pid = child.pid
        if (pid) { try { process.kill(-pid, 'SIGTERM') } catch { try { child.kill('SIGTERM') } catch {} } }
        setTimeout(() => { try { process.kill(-pid, 'SIGKILL') } catch { try { child.kill('SIGKILL') } catch {} } }, 600)
      } catch {}
    }
    this.activeChildren.clear()
    const runIdToReport = this.currentRunId
    if (runIdToReport) {
      try {
        getDb().prepare(`UPDATE project_runs SET status='stopped', completed_at=? WHERE id=?`).run(nowIso(), runIdToReport)
      } catch {}
      // Emit immediately so the UI flips out of the running state, plus a backstop in 1.5s.
      this.emitTyped('run_complete', { runId: runIdToReport, status: 'stopped', iterations: 0 })
      setTimeout(() => {
        this.emitTyped('run_complete', { runId: runIdToReport, status: 'stopped', iterations: 0 })
      }, 1_500)
    }
  }

  private async runInner(projectId: string, maxIterations: number, resume?: ResumeState, existingRunId?: string): Promise<string> {
    this.stopped = false
    const db = getDb()
    const project = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(projectId) as ProjectRow | undefined
    if (!project) throw new Error(`project not found: ${projectId}`)

    const runId = existingRunId || genId('run')
    this.currentRunId = runId
    if (!existingRunId) {
      db.prepare(`INSERT INTO project_runs (id, project_id, status, iteration, max_iterations, started_at) VALUES (?, ?, ?, ?, ?, ?)`)
        .run(runId, projectId, 'running', 0, maxIterations, nowIso())
    }
    this.emitTyped('run_created', { runId, projectId, maxIterations })

    const allAgents = db.prepare(`SELECT * FROM agents WHERE project_id = ?`).all(projectId) as AgentRow[]
    if (allAgents.length === 0) throw new Error('no agents configured')
    const workers = allAgents.filter((a) => (a.role_kind || 'worker') === 'worker')
    let reviewers = allAgents.filter((a) => (a.role_kind || 'worker') === 'reviewer')
    // Promote orphan reviewers to a final worker
    const validReviewers: AgentRow[] = []
    for (const r of reviewers) {
      if (r.reviews_agent_id && workers.some((w) => w.id === r.reviews_agent_id)) {
        validReviewers.push(r)
      } else {
        workers.push(r)
      }
    }
    reviewers = validReviewers

    workers.sort((a, b) => {
      const ra = ROLE_ORDER.indexOf((a.role || '').toLowerCase())
      const rb = ROLE_ORDER.indexOf((b.role || '').toLowerCase())
      const ia = ra === -1 ? 999 : ra
      const ib = rb === -1 ? 999 : rb
      if (ia !== ib) return ia - ib
      return a.execution_order - b.execution_order
    })

    clearHealthCache()
    clearVerificationCache()
    // Pre-warm the embedding model in the background so RAG search in buildContext
    // doesn't pay the ~10s Xenova cold start when the second agent runs.
    indexSource({ sourceType: 'warmup', sourceId: `warmup_${runId}`, projectId, content: 'warmup' })
      .catch(() => {})

    const adapters = buildAdaptersFromDb()
    if (adapters.length === 0) throw new Error('no LLM adapters configured')

    const startIteration = resume?.startIteration ?? 1
    let planningContext = resume?.planningContext ?? ''
    let prevQaIssues = resume?.prevQaIssues ?? ''
    let qaPassed = false

    for (let iteration = startIteration; iteration <= maxIterations; iteration++) {
      if (this.stopped) break
      this.emitTyped('iteration_start', { runId, iteration })
      db.prepare(`UPDATE project_runs SET iteration = ? WHERE id = ?`).run(iteration, runId)

      const iterationOutputs: Record<string, string> = resume && iteration === startIteration ? { ...resume.iterationOutputs } : {}

      for (const agent of workers) {
        if (this.stopped) break
        const role = (agent.role || '').toLowerCase()
        if (iteration > 1 && (PLANNING_ROLES.has(role) || ARCHITECT_ROLES.has(role))) continue
        if (resume && iteration === startIteration && resume.completedAgentIds.has(agent.id)) continue

        const stepId = genId('step')
        db.prepare(`INSERT INTO run_steps (id, run_id, agent_id, agent_name, role, iteration, status) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .run(stepId, runId, agent.id, agent.name, role, iteration, 'running')

        let verificationReport: VerificationReport | null = null
        if (VERIFY_BEFORE_ROLES.has(role)) {
          verificationReport = await runVerificationChecks(project.workspace_path)
        }

        const adapter = await this.pickAdapter(adapters)
        if (!adapter) {
          this.failStep(runId, stepId, 'no healthy adapter available')
          continue
        }
        if (adapter.providerType === 'cli' && adapter.cliCommand) {
          await prepareCliBeforeRun(adapter.cliCommand)
          adapter.modelId = await validateAndFixModelId(adapter.cliCommand, adapter.modelId)
        }

        const sessionId = `pipeline_${stepId}`
        this.activeSessions.add(sessionId)
        this.emitTyped('agent_start', { runId, stepId, agentId: agent.id, name: agent.name, role, iteration, sessionId })

        const filesBefore = snapshotMtimes(project.workspace_path)

        let output = ''
        try {
          if (ARCHITECT_ROLES.has(role) && iteration === 1) {
            output = await this.runArchitect(runId, stepId, agent, project, adapters, sessionId)
          } else {
            const messages = await this.buildMessages({
              project,
              agent,
              iteration,
              planningContext,
              iterationOutputs,
              prevQaIssues,
              verificationReport,
            })
            const { result, adapter: usedAdapter } = await invokeWithFailover({
              adapters,
              messages,
              cwd: project.workspace_path,
              sessionId,
              onChunk: (delta) => this.emitTyped('agent_chunk', { runId, stepId, delta }),
              onSession: (sid) => { this.activeSessions.add(sid) },
            })
            output = result.text
            db.prepare(`UPDATE run_steps SET tokens_used = ? WHERE id = ?`).run(result.tokens || 0, stepId)
            this.emitTyped('agent_complete', { runId, stepId, output: capRaw(output), tokens: result.tokens, modelLabel: result.modelLabel, providerType: usedAdapter.providerType })
          }
        } catch (err: any) {
          this.failStep(runId, stepId, err?.message || String(err))
          // If the architect fails, the workspace isn't viable — abort the iteration
          // rather than letting downstream agents hang on missing scaffolding.
          if (ARCHITECT_ROLES.has(role) && iteration === 1) {
            this.emitTyped('agent_chunk', { runId, stepId, delta: '\n[pipeline] aborting iteration: architect failed\n' })
            break
          }
          continue
        }

        // Detect file writes via mtime diff + textual blocks
        const filesAfter = snapshotMtimes(project.workspace_path)
        const writtenViaMtime = diffMtimes(filesBefore, filesAfter)
        const writtenViaBlocks = extractAndWriteFiles(project.workspace_path, output)
        const written = Array.from(new Set([...writtenViaMtime, ...writtenViaBlocks]))
        if (written.length) this.emitTyped('files_written', { runId, files: written })

        if (PLANNING_ROLES.has(role)) {
          this.writeTaskMd(project.workspace_path, agent, output)
          planningContext = (planningContext + '\n\n' + output).slice(-PLAN_CAP)
        } else {
          iterationOutputs[role || agent.id] = output.slice(0, PER_STEP_CAP)
        }

        db.prepare(`UPDATE run_steps SET status='completed', output=?, completed_at=? WHERE id=?`)
          .run(capRaw(output), nowIso(), stepId)

        // Persist this agent's output as a Markdown artifact inside the workspace
        try {
          const artifact = writeAgentArtifact(project.workspace_path, {
            runId, iteration, role, name: agent.name, output,
          })
          this.emitTyped('agent_artifact', { runId, stepId, iteration, role, name: agent.name, ...artifact })
          // Index the cleaned .md content for semantic retrieval by future agents.
          // This is separate from the raw run_step indexing — we want clean, role-tagged sources.
          indexSource({
            sourceType: 'agent_md',
            sourceId: `${runId}:${stepId}`,
            projectId,
            content: `# ${agent.name} (${role}) — iter ${iteration}\n\n${output}`,
          }).catch((e) => console.error('[pipeline] embed agent_md failed:', e))
        } catch (err) {
          console.error('[pipeline] writeAgentArtifact failed:', err)
        }

        // Reviewer phase
        const reviewer = reviewers.find((r) => r.reviews_agent_id === agent.id)
        if (reviewer) {
          if (VERIFY_REVIEWER_OF_ROLES.has(role)) {
            verificationReport = await runVerificationChecks(project.workspace_path)
          }
          const reviewOk = await this.runReviewerStep({
            runId, project, adapters, reviewer, workerAgent: agent, workerStepId: stepId, workerOutput: output, verificationReport, iteration,
          })
          if (!reviewOk) {
            // Loop ends; QA / next iteration will handle
          }
        }

        if (role === 'qa') {
          const verdict = parseQaVerdict(output)
          this.emitTyped('qa_verdict', { runId, iteration, passed: verdict.passed, issues: verdict.issues })
          db.prepare(`UPDATE run_steps SET verdict = ? WHERE id = ?`).run(verdict.passed ? 'approve' : 'request_changes', stepId)
          if (verdict.passed) qaPassed = true
          else prevQaIssues = (verdict.issues || output).slice(0, PER_STEP_CAP)
        }

        // Index output as embedding (truncated)
        try {
          await indexSource({
            sourceType: 'run_step',
            sourceId: stepId,
            projectId,
            content: output.slice(0, 200_000),
          })
        } catch (err) {
          console.error('[pipeline] embed index failed:', err)
        }
      }

      if (qaPassed) break
    }

    if (this.stopped) {
      // stop() already emitted run_complete and updated DB — don't double-emit
      this.currentRunId = null
      return runId
    }
    const status: 'completed' | 'failed' = 'completed'
    db.prepare(`UPDATE project_runs SET status=?, completed_at=? WHERE id=?`).run(status, nowIso(), runId)
    this.emitTyped('run_complete', { runId, status, iterations: maxIterations })
    this.currentRunId = null
    return runId
  }

  private async pickAdapter(adapters: LLMAdapter[]): Promise<LLMAdapter | null> {
    return pickFirstHealthyAdapter(adapters)
  }

  private async runArchitect(runId: string, stepId: string, agent: AgentRow, project: ProjectRow, adapters: LLMAdapter[], sessionId: string): Promise<string> {
    const fragments: string[] = []
    // Phase 1: scaffold (deterministic)
    const scaffold = getScaffoldCommand(project.framework)
    if (scaffold) {
      // Skip scaffold if workspace already looks scaffolded (idempotent across runs)
      const alreadyScaffolded = fs.existsSync(path.join(project.workspace_path, 'package.json'))
      if (alreadyScaffolded) {
        fragments.push('[architect] workspace already scaffolded — skipping scaffold')
        this.emitTyped('agent_chunk', { runId, stepId, delta: fragments[fragments.length - 1] + '\n' })
      } else {
        // Stash ALL existing files (task.md, BACKLOG.md, dotfiles, etc) outside the workspace
        // so that create-next-app sees a clean directory.
        const stashRoot = path.join(project.workspace_path, '..', `.${path.basename(project.workspace_path)}.stash-${Date.now()}`)
        const stashed = stashAllExcept(project.workspace_path, stashRoot, ['node_modules'])
        fragments.push(`[architect] scaffold: ${scaffold.command} ${scaffold.args.join(' ')}`)
        this.emitTyped('agent_chunk', { runId, stepId, delta: fragments[fragments.length - 1] + '\n' })
        try {
          await this.runShell(project.workspace_path, scaffold.command, scaffold.args, scaffold.timeoutMs, (d) => this.emitTyped('agent_chunk', { runId, stepId, delta: d }))
        } finally {
          // Restore stashed files on top of the scaffold (overwrite scaffold-generated files of same name)
          if (stashed) restoreOnTop(stashRoot, project.workspace_path)
          try { fs.rmSync(stashRoot, { recursive: true, force: true }) } catch {}
        }
      }
    }
    // Phase 2: npm install
    fragments.push('[architect] npm install')
    this.emitTyped('agent_chunk', { runId, stepId, delta: '[architect] npm install\n' })
    try {
      await this.runShell(project.workspace_path, 'npm', ['install'], 10 * 60_000, (d) => this.emitTyped('agent_chunk', { runId, stepId, delta: d }))
    } catch (err: any) {
      this.emitTyped('agent_chunk', { runId, stepId, delta: `[architect] npm install failed: ${err?.message || err}\n` })
    }
    // Phase 3: LLM-driven libs / db / auth
    const messages: ChatMessage[] = [
      { role: 'system', content: agent.system_prompt || defaultSystemPrompt('architect') },
      { role: 'user', content: `Install necessary libraries (DB, auth, config) for project "${project.name}". Framework: ${project.framework}. Tech stack: ${project.tech_stack || 'auto'}. Workspace is ${project.workspace_path}. Run shell commands as needed.` },
    ]
    try {
      const { result } = await invokeWithFailover({
        adapters,
        messages,
        cwd: project.workspace_path,
        onChunk: (d) => this.emitTyped('agent_chunk', { runId, stepId, delta: d }),
        onSession: (sid) => this.activeSessions.add(sid),
      })
      fragments.push(result.text)
    } catch (err: any) {
      fragments.push(`[architect] llm phase failed: ${err?.message || err}`)
    }
    // Phase 4: dev server fire-and-forget
    devServerManager.start(project.id, project.workspace_path).catch((e) => {
      this.emitTyped('agent_chunk', { runId, stepId, delta: `[architect] devserver start failed: ${e?.message || e}\n` })
    })
    return fragments.join('\n\n')
  }

  private async runReviewerStep(args: {
    runId: string
    project: ProjectRow
    adapters: LLMAdapter[]
    reviewer: AgentRow
    workerAgent: AgentRow
    workerStepId: string
    workerOutput: string
    verificationReport: VerificationReport | null
    iteration: number
  }): Promise<boolean> {
    const db = getDb()
    const max = Math.max(1, args.reviewer.max_iterations || 1)
    let approved = false
    let lastFeedback = ''
    for (let attempt = 1; attempt <= max; attempt++) {
      if (this.stopped) break
      const reviewerStepId = genId('step')
      db.prepare(`INSERT INTO run_steps (id, run_id, agent_id, agent_name, role, iteration, status, reviewer_of_step_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(reviewerStepId, args.runId, args.reviewer.id, args.reviewer.name, 'reviewer', args.iteration, 'running', args.workerStepId)
      this.emitTyped('agent_start', { runId: args.runId, stepId: reviewerStepId, agentId: args.reviewer.id, name: args.reviewer.name, role: 'reviewer', iteration: args.iteration })

      const messages: ChatMessage[] = [
        { role: 'system', content: args.reviewer.system_prompt || REVIEWER_DEFAULT_PROMPT },
        { role: 'user', content: buildReviewerUserPrompt({
          workerName: args.workerAgent.name,
          workerRole: args.workerAgent.role || 'worker',
          workerOutput: args.workerOutput,
          verificationReport: args.verificationReport ? formatReportForPrompt(args.verificationReport) : undefined,
          attempt,
          maxAttempts: max,
        })},
      ]
      try {
        const { result } = await invokeWithFailover({
          adapters: args.adapters,
          messages,
          cwd: args.project.workspace_path,
          onChunk: (delta) => this.emitTyped('agent_chunk', { runId: args.runId, stepId: reviewerStepId, delta }),
        })
        const parsed = parseReviewVerdict(result.text)
        const verdictDb = parsed.verdict === 'approve' ? 'approve' : 'request_changes'
        // Force REQUEST_CHANGES if verification failed
        const finalVerdict: 'approve' | 'request_changes' = (args.verificationReport?.hasFailures && parsed.verdict === 'approve')
          ? 'request_changes'
          : parsed.verdict
        db.prepare(`UPDATE run_steps SET status='completed', output=?, verdict=?, completed_at=? WHERE id=?`)
          .run(capRaw(result.text), finalVerdict, nowIso(), reviewerStepId)
        this.emitTyped('review_verdict', { runId: args.runId, reviewerStepId, workerStepId: args.workerStepId, verdict: finalVerdict, feedback: parsed.feedback, attempt })
        lastFeedback = parsed.feedback
        if (finalVerdict === 'approve') { approved = true; break }
      } catch (err: any) {
        this.failStep(args.runId, reviewerStepId, err?.message || String(err))
        break
      }
    }
    return approved
  }

  private failStep(runId: string, stepId: string, message: string): void {
    try {
      getDb().prepare(`UPDATE run_steps SET status='failed', output=?, completed_at=? WHERE id=?`).run(message, nowIso(), stepId)
    } catch {}
    this.emitTyped('agent_error', { runId, stepId, message })
  }

  private async buildMessages(args: {
    project: ProjectRow
    agent: AgentRow
    iteration: number
    planningContext: string
    iterationOutputs: Record<string, string>
    prevQaIssues: string
    verificationReport: VerificationReport | null
  }): Promise<ChatMessage[]> {
    const role = (args.agent.role || 'worker').toLowerCase()
    const sys = args.agent.system_prompt || defaultSystemPrompt(role)
    const ctx = await buildContext({
      project: args.project,
      agent: args.agent,
      iteration: args.iteration,
      planningContext: args.planningContext,
      iterationOutputs: args.iterationOutputs,
      prevQaIssues: args.prevQaIssues,
      verificationReport: args.verificationReport,
    })
    return [
      { role: 'system', content: sys },
      { role: 'user', content: ctx },
    ]
  }

  private writeTaskMd(workspace: string, agent: AgentRow, output: string): void {
    try {
      fs.mkdirSync(workspace, { recursive: true })
      const file = path.join(workspace, 'task.md')
      const header = `# task.md (updated by ${agent.name} / ${agent.role})\n\n`
      fs.writeFileSync(file, header + output)
    } catch (err) {
      console.error('[pipeline] writeTaskMd failed:', err)
    }
  }

  private runShell(cwd: string, command: string, args: string[], timeoutMs: number, onChunk: (d: string) => void): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: process.env, detached: true })
      this.activeChildren.add(child)
      const t = setTimeout(() => { try { child.kill('SIGKILL') } catch {}; reject(new Error(`${command} timeout`)) }, timeoutMs)
      child.stdout.on('data', (d) => onChunk(d.toString()))
      child.stderr.on('data', (d) => onChunk(d.toString()))
      const finalize = (err: Error | null, code: number | null = null) => {
        clearTimeout(t)
        this.activeChildren.delete(child)
        if (this.stopped) return reject(new Error('stopped'))
        if (err) return reject(err)
        if (code === 0) return resolve()
        reject(new Error(`${command} exit ${code}`))
      }
      child.on('exit', (code) => finalize(null, code))
      child.on('error', (err) => finalize(err))
    })
  }
}

// ───────── helpers ─────────

function defaultSystemPrompt(role: string): string {
  const r = role.toLowerCase()
  switch (r) {
    case 'ceo': return 'You are the CEO. Define vision, audience, success metrics for the product. Output a concise plan.'
    case 'pm': return 'You are the Product Manager. Translate the CEO vision into a prioritized backlog and a task.md outline.'
    case 'architect': return 'You are the Architect. Decide stack, packages, folder layout. Bootstrap the project deterministically.'
    case 'designer': return 'You are the Designer. Produce design tokens, base components and Tailwind classes for the chosen palette.'
    case 'dev':
    case 'fullstack':
    case 'backend':
    case 'frontend': return 'You are a senior software engineer. Write production-ready code. Use === FILE: path === / === END FILE === blocks for files.'
    case 'devops': return 'You are the DevOps engineer. Configure CI, deployment and runtime.'
    case 'qa': return 'You are the QA. Run the project, list any failing checks, then output PASS or FAIL: <issues>.'
    case 'reviewer': return REVIEWER_DEFAULT_PROMPT
    default: return 'You are a helpful agent.'
  }
}

const RAG_BUDGET_BYTES = parseInt(process.env.OPENLINA_RAG_BUDGET || '', 10) || 5_000
const RAG_TOP_K = parseInt(process.env.OPENLINA_RAG_K || '', 10) || 6
// Lowered: with anything beyond a single small .md, RAG is worth it for prompt-size savings.
const RAG_MIN_BYTES_TO_USE_RAG = parseInt(process.env.OPENLINA_RAG_MIN || '', 10) || 1_500

async function buildContext(args: {
  project: ProjectRow
  agent: AgentRow
  iteration: number
  planningContext: string
  iterationOutputs: Record<string, string>
  prevQaIssues: string
  verificationReport: VerificationReport | null
}): Promise<string> {
  const parts: string[] = []
  parts.push(`# Project: ${args.project.name}`)
  if (args.project.description) parts.push(args.project.description)
  parts.push(`Framework: ${args.project.framework || 'unspecified'}; Workspace: ${args.project.workspace_path}`)
  parts.push(`Iteration: ${args.iteration}`)

  // Discover all .md files written so far across all iterations
  const allMds = readAllAgentMds(args.project.workspace_path)
  const totalBytes = allMds.reduce((acc, m) => acc + m.content.length, 0)

  // Always show a compact INDEX so the agent knows the full picture
  if (allMds.length) {
    parts.push('\n## Available .md files (full list — read via embeddings below)')
    for (const m of allMds) {
      parts.push(`- ${m.relativePath} (${(m.content.length / 1024).toFixed(1)} KB)`)
    }
  }

  // RAG path vs. paste-all path. Small total → paste verbatim; large → semantic search.
  const useRag = totalBytes > RAG_MIN_BYTES_TO_USE_RAG
  let strategy = 'none'
  let chunksUsed = 0
  let bytesUsed = 0
  if (allMds.length) {
    if (useRag) {
      const query = `${args.agent.name} ${args.agent.role || ''} ${args.agent.responsibilities || ''} ${args.project.description || ''}`.trim()
      try {
        const hits = await searchEmbeddings({ query, projectId: args.project.id, k: RAG_TOP_K, sourceType: 'agent_md' })
        if (hits.length) {
          parts.push('\n## Most relevant excerpts (semantic search on your role + responsibilities)')
          let used = 0
          for (const h of hits) {
            const block = `\n### score=${h.score.toFixed(3)} · source=${h.sourceType}#${h.sourceId} chunk ${h.chunkIndex}\n${h.content}`
            if (used + block.length > RAG_BUDGET_BYTES) break
            parts.push(block)
            used += block.length
            chunksUsed++
          }
          bytesUsed = used
          strategy = `RAG (${chunksUsed}/${hits.length} chunks · ${(used/1024).toFixed(1)} KB)`
        } else {
          strategy = 'RAG (0 hits — index empty?)'
        }
      } catch (err) {
        console.error('[pipeline] embedding search failed, falling back to truncated paste:', err)
        parts.push('\n## Previous .md (embeddings unavailable, truncated paste)')
        for (const m of allMds) {
          const t = truncate(m.content, 1500)
          parts.push(`\n### ${m.relativePath}\n${t}`)
          bytesUsed += t.length
        }
        strategy = `paste-truncated (embeddings failed: ${(err as any)?.message || 'unknown'})`
      }
    } else {
      parts.push('\n## Previous .md (small enough to paste verbatim)')
      for (const m of allMds) {
        parts.push(`\n### ${m.relativePath}\n${m.content}`)
        bytesUsed += m.content.length
      }
      strategy = `paste-verbatim (total ${(totalBytes/1024).toFixed(1)} KB < ${(RAG_MIN_BYTES_TO_USE_RAG/1024).toFixed(1)} KB threshold)`
    }
  } else {
    strategy = 'no prior .md files'
  }
  // Visible banner at top of context so the user can see exactly what was injected.
  parts.splice(2, 0, `\n[OpenLina context strategy] ${allMds.length} .md files (${(totalBytes/1024).toFixed(1)} KB raw) → ${strategy}`)
  console.log(`[pipeline] ${args.agent.name} (${args.agent.role}) iter${args.iteration}: ${allMds.length} .md (${totalBytes}B raw) → ${strategy}, bytes injected: ${bytesUsed}`)

  // task.md is the canonical contract — small and always relevant. Paste verbatim if exists.
  const taskMdPath = path.join(args.project.workspace_path, 'task.md')
  if (fs.existsSync(taskMdPath)) {
    try {
      const content = fs.readFileSync(taskMdPath, 'utf8')
      if (content.trim()) {
        parts.push('\n## task.md (root of workspace — canonical contract)')
        parts.push(truncate(content, PLAN_CAP))
      }
    } catch {}
  }

  // In-memory fallback for an agent whose .md hasn't been written/indexed yet (race during a single iteration)
  const peerOutputs = Object.entries(args.iterationOutputs)
  const seenRoles = new Set(allMds.map((m) => m.role))
  const missingPeers = peerOutputs.filter(([role]) => !seenRoles.has(role))
  if (missingPeers.length) {
    parts.push('\n## In-memory peer outputs (not yet on disk)')
    for (const [role, out] of missingPeers) {
      parts.push(`### ${role}\n` + truncate(out, PER_STEP_CAP))
    }
  }

  if (args.prevQaIssues) {
    parts.push('\n## Issues raised by QA in previous iteration')
    parts.push(truncate(args.prevQaIssues, PER_STEP_CAP))
  }
  if (args.verificationReport) {
    parts.push('\n## Deterministic verification report')
    parts.push(formatReportForPrompt(args.verificationReport))
  }
  parts.push('\n## Your role')
  parts.push(`${args.agent.name} (${args.agent.role}). ${args.agent.responsibilities || ''}`)
  parts.push(`\nYour .md output will be saved to .openlina/agents/iter${args.iteration}/${(args.agent.role || 'agent')}-${(args.agent.name || '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 40)}.md, indexed as embeddings, and surfaced to the next agents via semantic search.`)
  parts.push('Write file blocks as: \n=== FILE: relative/path ===\n<contents>\n=== END FILE ===\n')
  const final = parts.join('\n')
  console.log(`[pipeline] ${args.agent.name} final prompt: ${final.length} bytes (~${Math.ceil(final.length/4)} tokens)`)
  return final
}

interface AgentMd { relativePath: string; role: string; iteration: number; content: string }
function readAgentMds(workspace: string, iteration: number): AgentMd[] {
  const dir = path.join(workspace, '.openlina', 'agents', `iter${iteration}`)
  if (!fs.existsSync(dir)) return []
  let entries: string[] = []
  try { entries = fs.readdirSync(dir).filter((f) => f.endsWith('.md')) } catch { return [] }
  const out: AgentMd[] = []
  for (const f of entries.sort()) {
    try {
      const raw = fs.readFileSync(path.join(dir, f), 'utf8')
      const clean = raw.replace(/^<!--[\s\S]*?-->\n/, '').trimStart()
      const role = f.split('-')[0] || 'agent'
      out.push({ relativePath: path.join('.openlina', 'agents', `iter${iteration}`, f), role, iteration, content: clean })
    } catch {}
  }
  return out
}

function readAllAgentMds(workspace: string): AgentMd[] {
  const root = path.join(workspace, '.openlina', 'agents')
  if (!fs.existsSync(root)) return []
  let dirs: string[] = []
  try { dirs = fs.readdirSync(root).filter((d) => /^iter\d+$/.test(d)) } catch { return [] }
  // Sort by iteration ascending so prompts read chronologically
  dirs.sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10))
  const out: AgentMd[] = []
  for (const d of dirs) {
    const iter = parseInt(d.slice(4), 10) || 0
    out.push(...readAgentMds(workspace, iter))
  }
  return out
}

function truncate(s: string, max: number): string {
  if (!s) return ''
  if (s.length <= max) return s
  return s.slice(0, max) + `\n[... ${s.length - max} bytes truncated ...]`
}

function capRaw(s: string): string {
  if (!s) return ''
  if (s.length <= RAW_OUTPUT_CAP) return s
  return `${s.slice(0, RAW_OUTPUT_CAP / 2)}\n[... truncated ...]\n${s.slice(-RAW_OUTPUT_CAP / 2)}`
}

interface ArtifactArgs { runId: string; iteration: number; role: string; name: string; output: string }
function writeAgentArtifact(workspace: string, args: ArtifactArgs): { relativePath: string; absolutePath: string } {
  const safeRole = (args.role || 'agent').replace(/[^a-z0-9_-]/gi, '-')
  const safeName = (args.name || '').replace(/[^a-z0-9_-]/gi, '-').slice(0, 40)
  const relDir = path.join('.openlina', 'agents', `iter${args.iteration}`)
  const file = `${safeRole}${safeName ? '-' + safeName : ''}.md`
  const relativePath = path.join(relDir, file)
  const absolutePath = path.join(workspace, relativePath)
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true })
  const header = `<!-- run=${args.runId} iter=${args.iteration} role=${args.role} name=${args.name} ts=${new Date().toISOString()} -->\n# ${args.name} (${args.role}) — iteration ${args.iteration}\n\n`
  fs.writeFileSync(absolutePath, header + (args.output || ''))
  return { relativePath, absolutePath }
}

function stashAllExcept(workspace: string, stashRoot: string, skip: string[]): boolean {
  if (!fs.existsSync(workspace)) return false
  const entries = fs.readdirSync(workspace, { withFileTypes: true }).filter((e) => !skip.includes(e.name))
  if (entries.length === 0) return false
  fs.mkdirSync(stashRoot, { recursive: true })
  for (const e of entries) {
    const src = path.join(workspace, e.name)
    const dst = path.join(stashRoot, e.name)
    try { fs.renameSync(src, dst) } catch (err) {
      try { fs.cpSync(src, dst, { recursive: true }); fs.rmSync(src, { recursive: true, force: true }) } catch {}
    }
  }
  return true
}

function restoreOnTop(stashRoot: string, workspace: string): void {
  if (!fs.existsSync(stashRoot)) return
  for (const e of fs.readdirSync(stashRoot, { withFileTypes: true })) {
    const src = path.join(stashRoot, e.name)
    const dst = path.join(workspace, e.name)
    try {
      if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true })
      fs.renameSync(src, dst)
    } catch (err) {
      try { fs.cpSync(src, dst, { recursive: true }) } catch {}
    }
  }
}

function snapshotMtimes(root: string): Map<string, number> {
  const out = new Map<string, number>()
  if (!fs.existsSync(root)) return out
  const SKIP = new Set(['node_modules', '.git', '.next', '.openlina-data', '.openlina-stash'])
  const stack: string[] = [root]
  while (stack.length) {
    const dir = stack.pop()!
    let entries: fs.Dirent[]
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const e of entries) {
      if (SKIP.has(e.name)) continue
      const full = path.join(dir, e.name)
      try {
        if (e.isDirectory()) stack.push(full)
        else if (e.isFile()) {
          const stat = fs.statSync(full)
          out.set(full, stat.mtimeMs)
        }
      } catch {}
    }
  }
  return out
}

function diffMtimes(before: Map<string, number>, after: Map<string, number>): string[] {
  const changed: string[] = []
  for (const [file, m] of after) {
    const prev = before.get(file)
    if (prev === undefined || m > prev) changed.push(file)
  }
  return changed
}

const FILE_BLOCK_RE = /===\s*FILE:\s*([^=\n]+?)\s*===\n([\s\S]*?)\n===\s*END FILE\s*===/g

function extractAndWriteFiles(workspace: string, output: string): string[] {
  const written: string[] = []
  let match: RegExpExecArray | null
  FILE_BLOCK_RE.lastIndex = 0
  while ((match = FILE_BLOCK_RE.exec(output)) !== null) {
    const rel = match[1].trim()
    const content = match[2]
    if (rel.startsWith('/') || rel.includes('..')) continue
    const full = path.join(workspace, rel)
    try {
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, content)
      written.push(full)
    } catch (err) {
      console.error('[pipeline] write file failed:', rel, err)
    }
  }
  return written
}

function parseQaVerdict(output: string): { passed: boolean; issues?: string } {
  if (/^|\n\s*PASS\b/i.test(output)) return { passed: true }
  if (/^|\n\s*FAIL\b/i.test(output)) {
    const idx = output.search(/FAIL\b/i)
    return { passed: false, issues: output.slice(idx).slice(0, 4000) }
  }
  // No explicit verdict → assume fail for safety
  return { passed: false, issues: output.slice(0, 4000) }
}
