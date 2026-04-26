'use client'
import { useEffect, useState } from 'react'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface Metrics {
  generatedAt: string
  volume: any
  reliability: any
  performance: any
  failover7d: any
  quality: any
}

function pct(v: number | null): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(1)}%`
}

function num(v: any): string {
  if (v == null) return '—'
  if (typeof v === 'number') return v.toLocaleString()
  return String(v)
}

function dur(sec: any): string {
  if (sec == null) return '—'
  const s = Number(sec)
  if (s < 60) return `${s.toFixed(1)}s`
  return `${(s / 60).toFixed(1)}m`
}

const SUCCESS_TARGET = 0.95
const QA_PASS_TARGET = 0.7

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'good' | 'warn' | 'bad' | 'neutral' }) {
  const toneClass = tone === 'good' ? 'border-success/40' : tone === 'warn' ? 'border-warn/40' : tone === 'bad' ? 'border-danger/40' : ''
  return (
    <Card className={toneClass}>
      <CardBody>
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
        {hint && <div className="text-xs text-muted mt-1">{hint}</div>}
      </CardBody>
    </Card>
  )
}

export default function MetricsPage() {
  const [m, setM] = useState<Metrics | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true); setError(null)
    try {
      const r = await fetch('/api/metrics').then((r) => r.json())
      if (!r.ok) throw new Error(r.error)
      setM(r.data)
    } catch (err: any) { setError(err?.message || String(err)) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  if (error) return <div className="p-6 text-danger text-sm">{error}</div>
  if (!m) return <div className="p-6 text-muted text-sm">Loading metrics…</div>

  const successRate = m.reliability.stepSuccessRate
  const qaPass = m.quality.qa.passRate
  const reviewerApprove = m.quality.reviewer.approveRate
  const coldTimeoutCount = (m.failover7d.byBucket || []).find((b: any) => b.bucket === 'cold timeout')?.c || 0
  const totalFailover = m.failover7d.total

  return (
    <div className="p-6 max-w-6xl mx-auto pb-20">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Metrics</h1>
          <p className="text-sm text-muted">Last 7 days. Generated {new Date(m.generatedAt).toLocaleString()}.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={load} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* Top-level KPIs */}
      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-wide text-muted mb-2">Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Step success"
            value={pct(successRate)}
            hint={`Target ≥ ${pct(SUCCESS_TARGET)}`}
            tone={successRate == null ? 'neutral' : successRate >= SUCCESS_TARGET ? 'good' : successRate >= 0.8 ? 'warn' : 'bad'}
          />
          <StatCard
            label="QA pass rate"
            value={pct(qaPass)}
            hint={`${num(m.quality.qa.approved)} approved / ${num(m.quality.qa.changes)} changes`}
            tone={qaPass == null ? 'neutral' : qaPass >= QA_PASS_TARGET ? 'good' : qaPass >= 0.4 ? 'warn' : 'bad'}
          />
          <StatCard
            label="Reviewer approve rate"
            value={pct(reviewerApprove)}
            hint={`${num(m.quality.reviewer.approved)} ✓ / ${num(m.quality.reviewer.changes)} ✗`}
            tone={reviewerApprove == null ? 'neutral' : reviewerApprove >= 0.6 ? 'good' : 'warn'}
          />
          <StatCard
            label="Cold timeouts (7d)"
            value={num(coldTimeoutCount)}
            hint={`of ${num(totalFailover)} failovers`}
            tone={coldTimeoutCount === 0 ? 'good' : coldTimeoutCount < 5 ? 'warn' : 'bad'}
          />
        </div>
      </section>

      <section className="mb-6">
        <h2 className="text-xs uppercase tracking-wide text-muted mb-2">Volume</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Runs (24h)" value={num(m.volume.runs24h)} />
          <StatCard label="Runs (7d)" value={num(m.volume.runs7d)} hint={`${num(m.volume.runsTotal)} lifetime`} />
          <StatCard label="Steps (lifetime)" value={num(m.volume.stepsTotal)} />
          <StatCard label="Tokens (lifetime)" value={num(m.volume.tokensTotal)} hint={`API steps only`} />
        </div>
      </section>

      <section className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><div className="font-medium">Avg step duration by role</div></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted">
                <th className="text-left py-1">Role</th>
                <th className="text-right py-1">N</th>
                <th className="text-right py-1">Avg</th>
                <th className="text-right py-1">Max</th>
              </tr></thead>
              <tbody>
                {(m.performance.stepDurationByRole || []).map((r: any) => (
                  <tr key={r.role} className="border-t border-border">
                    <td className="py-1.5">{r.role || '—'}</td>
                    <td className="text-right">{num(r.n)}</td>
                    <td className="text-right">{dur(r.avg_sec)}</td>
                    <td className="text-right text-muted">{dur(r.max_sec)}</td>
                  </tr>
                ))}
                {(!m.performance.stepDurationByRole?.length) && <tr><td colSpan={4} className="text-muted py-2">No completed steps yet.</td></tr>}
              </tbody>
            </table>
            <div className="text-xs text-muted mt-2">Avg = wall time from agent start to completion. Look for outliers; if architect &gt; 5m consistently, scaffold is the bottleneck.</div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div className="font-medium">Run duration</div></CardHeader>
          <CardBody>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted">Successful runs</div>
              <div className="text-right">{num(m.performance.runDuration?.n)}</div>
              <div className="text-muted">Avg duration</div>
              <div className="text-right">{dur(m.performance.runDuration?.avg_sec)}</div>
              <div className="text-muted">Max duration</div>
              <div className="text-right">{dur(m.performance.runDuration?.max_sec)}</div>
              <div className="text-muted">Avg iterations to converge</div>
              <div className="text-right">{num(m.quality.avgIterationsToConverge?.avg_iters)}</div>
            </div>
            <div className="text-xs text-muted mt-3">
              If avg iterations &gt; 2, agents are looping due to QA rejections — check QA fail patterns below.
            </div>
          </CardBody>
        </Card>
      </section>

      <section className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><div className="font-medium">Failover buckets (7d)</div></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <tbody>
                {(m.failover7d.byBucket || []).map((b: any) => (
                  <tr key={b.bucket} className="border-t border-border">
                    <td className="py-1.5"><Badge variant={b.bucket.includes('timeout') ? 'danger' : b.bucket === 'rate limit' ? 'warn' : 'neutral'}>{b.bucket}</Badge></td>
                    <td className="text-right font-mono">{num(b.c)}</td>
                  </tr>
                ))}
                {(!m.failover7d.byBucket?.length) && <tr><td className="text-muted py-2">No failovers in window. ✓</td></tr>}
              </tbody>
            </table>
            <div className="text-xs text-muted mt-3">
              <strong className="text-text">cold timeout</strong> = CLI never produced output. <strong className="text-text">warm timeout</strong> = stalled mid-stream. Both suggest you should add an API fallback adapter, switch to Haiku model, or tune <code>OPENLINA_CLI_COLD_MS</code>.
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div className="font-medium">Adapter usage (7d, from failover log)</div></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <tbody>
                {(m.failover7d.adapterUsage || []).map((a: any, i: number) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5">
                      <div className="font-medium">{a.label || '(deleted)'}</div>
                      <div className="text-xs text-muted">{a.provider_type}{a.cli_command ? ` · ${a.cli_command}` : ''}</div>
                    </td>
                    <td className="text-right font-mono">{num(a.c)} fails</td>
                  </tr>
                ))}
                {(!m.failover7d.adapterUsage?.length) && <tr><td className="text-muted py-2">No adapter failures recorded.</td></tr>}
              </tbody>
            </table>
            <div className="text-xs text-muted mt-3">Counts only failures — not successes. An adapter with many fails is a candidate to disable or replace.</div>
          </CardBody>
        </Card>
      </section>

      <section className="mb-6">
        <Card>
          <CardHeader><div className="font-medium">Top error messages (7d)</div></CardHeader>
          <CardBody>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted">
                <th className="text-left py-1">Count</th>
                <th className="text-left py-1">Message</th>
              </tr></thead>
              <tbody>
                {(m.failover7d.topErrors || []).map((e: any, i: number) => (
                  <tr key={i} className="border-t border-border">
                    <td className="py-1.5 font-mono w-16">{num(e.c)}</td>
                    <td className="font-mono text-xs text-muted">{e.message}</td>
                  </tr>
                ))}
                {(!m.failover7d.topErrors?.length) && <tr><td colSpan={2} className="text-muted py-2">No errors. 🎉</td></tr>}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </section>

      <section className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><div className="font-medium">Step status breakdown</div></CardHeader>
          <CardBody>
            <div className="space-y-2 text-sm">
              {(m.reliability.stepsByStatus || []).map((s: any) => (
                <div key={s.status} className="flex items-center justify-between">
                  <Badge variant={s.status === 'completed' ? 'success' : s.status === 'failed' ? 'danger' : s.status === 'running' ? 'accent' : 'neutral'}>{s.status}</Badge>
                  <span className="font-mono">{num(s.c)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader><div className="font-medium">Embeddings index</div></CardHeader>
          <CardBody>
            <div className="text-2xl font-semibold mb-2">{num(m.volume.embeddingsTotal)}</div>
            <div className="text-xs text-muted mb-3">Total chunks indexed (model: Xenova all-MiniLM-L6-v2, 384 dims)</div>
            <table className="w-full text-sm">
              <tbody>
                {(m.volume.embeddingsByType || []).map((t: any) => (
                  <tr key={t.source_type} className="border-t border-border">
                    <td className="py-1.5 text-muted">{t.source_type}</td>
                    <td className="text-right font-mono">{num(t.c)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs text-muted mt-3">If <code>agent_md</code> count is low, RAG isn&apos;t being fed and prompts will be larger.</div>
          </CardBody>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader><div className="font-medium">Recommendations</div></CardHeader>
          <CardBody>
            <ul className="text-sm space-y-2">
              {coldTimeoutCount > 0 && <li>⚠ <strong>{coldTimeoutCount}</strong> cold timeouts in the last 7 days. Add an API fallback adapter (Anthropic / OpenAI) at higher priority — failover triggers automatically when the CLI hangs.</li>}
              {successRate != null && successRate < SUCCESS_TARGET && <li>⚠ Step success rate {pct(successRate)} below target {pct(SUCCESS_TARGET)}. Inspect &quot;Top error messages&quot; below for the dominant cause.</li>}
              {qaPass != null && qaPass < QA_PASS_TARGET && <li>⚠ QA pass rate {pct(qaPass)} below target {pct(QA_PASS_TARGET)}. Either prompts need stronger contracts or QA is over-strict — review a few failed runs.</li>}
              {m.quality.avgIterationsToConverge?.avg_iters && Number(m.quality.avgIterationsToConverge.avg_iters) > 2 && <li>⚠ Runs converge after {m.quality.avgIterationsToConverge.avg_iters} iterations on average. Consider tightening the architect/dev prompts or raising QA tolerance.</li>}
              {m.volume.embeddingsByType?.find((t: any) => t.source_type === 'agent_md')?.c < 3 && <li>⚠ Few <code>agent_md</code> embeddings indexed. RAG isn&apos;t kicking in — agent prompts are large and slower than they should be.</li>}
              {coldTimeoutCount === 0 && (successRate ?? 1) >= SUCCESS_TARGET && <li>✓ No critical issues — system is healthy.</li>}
            </ul>
          </CardBody>
        </Card>
      </section>
    </div>
  )
}
