import { getDb } from '@/lib/db'
import { ok, fail } from '@/lib/api/json'

export const runtime = 'nodejs'

const DAY = 24 * 60 * 60 * 1000

function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * DAY).toISOString()
}

export async function GET() {
  try {
    const db = getDb()
    const since7 = isoDaysAgo(7)
    const since24 = isoDaysAgo(1)

    // ── Volume ──
    const runsTotal = (db.prepare(`SELECT COUNT(*) AS c FROM project_runs`).get() as any).c
    const runs7 = (db.prepare(`SELECT COUNT(*) AS c FROM project_runs WHERE started_at > ?`).get(since7) as any).c
    const runs24 = (db.prepare(`SELECT COUNT(*) AS c FROM project_runs WHERE started_at > ?`).get(since24) as any).c
    const stepsTotal = (db.prepare(`SELECT COUNT(*) AS c FROM run_steps`).get() as any).c
    const stepsTokens = (db.prepare(`SELECT COALESCE(SUM(tokens_used), 0) AS t FROM run_steps`).get() as any).t
    const embTotal = (db.prepare(`SELECT COUNT(*) AS c FROM embeddings`).get() as any).c
    const embByType = db.prepare(`SELECT source_type, COUNT(*) AS c FROM embeddings GROUP BY source_type ORDER BY c DESC`).all()

    // ── Reliability: step status breakdown ──
    const stepsByStatus = db.prepare(`SELECT status, COUNT(*) AS c FROM run_steps GROUP BY status`).all() as any[]
    const totalCompletedOrFailed = stepsByStatus.filter((s) => s.status === 'completed' || s.status === 'failed').reduce((acc, s) => acc + s.c, 0)
    const totalCompleted = stepsByStatus.find((s) => s.status === 'completed')?.c || 0
    const successRate = totalCompletedOrFailed > 0 ? totalCompleted / totalCompletedOrFailed : null

    // ── Reliability: runs by status ──
    const runsByStatus = db.prepare(`SELECT status, COUNT(*) AS c FROM project_runs GROUP BY status ORDER BY c DESC`).all()

    // ── Performance: avg step duration by role (only completed steps) ──
    const stepDurationByRole = db.prepare(`
      SELECT role,
             COUNT(*) AS n,
             ROUND(AVG((julianday(completed_at) - julianday(created_at)) * 86400.0), 1) AS avg_sec,
             ROUND(MAX((julianday(completed_at) - julianday(created_at)) * 86400.0), 1) AS max_sec,
             ROUND(MIN((julianday(completed_at) - julianday(created_at)) * 86400.0), 1) AS min_sec
      FROM run_steps
      WHERE status = 'completed' AND completed_at IS NOT NULL AND created_at IS NOT NULL
      GROUP BY role
      ORDER BY avg_sec DESC
    `).all()

    // ── Performance: avg run duration ──
    const runDuration = db.prepare(`
      SELECT
        COUNT(*) AS n,
        ROUND(AVG((julianday(completed_at) - julianday(started_at)) * 86400.0), 1) AS avg_sec,
        ROUND(MAX((julianday(completed_at) - julianday(started_at)) * 86400.0), 1) AS max_sec
      FROM project_runs
      WHERE completed_at IS NOT NULL AND status = 'completed'
    `).get()

    // ── Failover & timeouts (last 7 days) ──
    const failoverTotal = (db.prepare(`SELECT COUNT(*) AS c FROM llm_failover_log WHERE ts > ?`).get(since7) as any).c
    const failoverByError = db.prepare(`
      SELECT
        CASE
          WHEN error_message LIKE '%cold timeout%' THEN 'cold timeout'
          WHEN error_message LIKE '%warm timeout%' THEN 'warm timeout'
          WHEN error_message LIKE '%wall-clock%' THEN 'wall timeout'
          WHEN error_message LIKE '%bailout%' THEN 'CLI bailout'
          WHEN error_message LIKE '%no output%' THEN 'no output'
          WHEN error_message LIKE '%401%' OR error_message LIKE '%unauthorized%' THEN 'auth'
          WHEN error_message LIKE '%429%' OR error_message LIKE '%rate%' THEN 'rate limit'
          WHEN error_message LIKE '%aborted%' THEN 'aborted'
          ELSE 'other'
        END AS bucket,
        COUNT(*) AS c
      FROM llm_failover_log
      WHERE ts > ?
      GROUP BY bucket
      ORDER BY c DESC
    `).all(since7)

    // ── Top error messages (last 7d, truncated for readability) ──
    const topErrors = db.prepare(`
      SELECT substr(error_message, 1, 160) AS message, COUNT(*) AS c
      FROM llm_failover_log
      WHERE ts > ?
      GROUP BY message
      ORDER BY c DESC
      LIMIT 10
    `).all(since7)

    // ── Quality: QA verdicts & iterations to converge ──
    const qaVerdicts = db.prepare(`
      SELECT verdict, COUNT(*) AS c
      FROM run_steps
      WHERE role = 'qa' AND verdict IS NOT NULL
      GROUP BY verdict
    `).all() as any[]
    const qaApproved = qaVerdicts.find((v) => v.verdict === 'approve')?.c || 0
    const qaChanges = qaVerdicts.find((v) => v.verdict === 'request_changes')?.c || 0
    const qaPassRate = (qaApproved + qaChanges) > 0 ? qaApproved / (qaApproved + qaChanges) : null

    // ── Reviewer feedback ──
    const reviewerVerdicts = db.prepare(`
      SELECT verdict, COUNT(*) AS c
      FROM run_steps
      WHERE role = 'reviewer' AND verdict IS NOT NULL
      GROUP BY verdict
    `).all() as any[]
    const reviewApproved = reviewerVerdicts.find((v) => v.verdict === 'approve')?.c || 0
    const reviewChanges = reviewerVerdicts.find((v) => v.verdict === 'request_changes')?.c || 0
    const reviewApproveRate = (reviewApproved + reviewChanges) > 0 ? reviewApproved / (reviewApproved + reviewChanges) : null

    // ── Iterations to converge (only successful runs that have a QA approve) ──
    const itersToConverge = db.prepare(`
      SELECT ROUND(AVG(min_iter), 1) AS avg_iters
      FROM (
        SELECT run_id, MIN(iteration) AS min_iter
        FROM run_steps
        WHERE role = 'qa' AND verdict = 'approve'
        GROUP BY run_id
      )
    `).get()

    // ── Adapter usage breakdown (from failover log — adapter that was tried) ──
    const adapterUsage = db.prepare(`
      SELECT lc.label, lc.provider_type, lc.cli_command, COUNT(*) AS c
      FROM llm_failover_log fl
      LEFT JOIN llm_configs lc ON lc.id = fl.llm_config_id
      WHERE fl.ts > ?
      GROUP BY fl.llm_config_id
      ORDER BY c DESC
    `).all(since7)

    // ── Time-to-first-byte proxy: silent-time markers in step output ──
    // We don't track TTFB directly; estimate via heartbeat marker count in step output.
    const ttfbProxy = db.prepare(`
      SELECT
        COUNT(*) AS sampled,
        SUM(CASE WHEN output LIKE '%silent for%' OR output LIKE '%thinking%' THEN 1 ELSE 0 END) AS slow,
        SUM(CASE WHEN output LIKE '%cold timeout%' THEN 1 ELSE 0 END) AS cold
      FROM run_steps
      WHERE created_at > ?
    `).get(since7)

    return ok({
      generatedAt: new Date().toISOString(),
      window: { since24h: since24, since7d: since7 },
      volume: {
        runsTotal, runs7d: runs7, runs24h: runs24,
        stepsTotal, tokensTotal: stepsTokens,
        embeddingsTotal: embTotal, embeddingsByType: embByType,
      },
      reliability: {
        stepsByStatus,
        runsByStatus,
        stepSuccessRate: successRate,
        ttfbProxy7d: ttfbProxy,
      },
      performance: {
        runDuration,
        stepDurationByRole,
      },
      failover7d: {
        total: failoverTotal,
        byBucket: failoverByError,
        topErrors,
        adapterUsage,
      },
      quality: {
        qa: { approved: qaApproved, changes: qaChanges, passRate: qaPassRate },
        reviewer: { approved: reviewApproved, changes: reviewChanges, approveRate: reviewApproveRate },
        avgIterationsToConverge: itersToConverge,
      },
    })
  } catch (err) { return fail(err) }
}
