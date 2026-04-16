'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Check, ChevronRight, Plus, X } from 'lucide-react'
import { AssetUploader } from '@/components/shared/AssetUploader'

const STEPS = ['Type', 'Details', 'Branding', 'Features', 'Tech', 'Team', 'Review']

const PROJECT_TYPES = [
  { id: 'web',      label: 'Web App',      icon: '🌐', desc: 'SPA, SSR, full web experience' },
  { id: 'saas',     label: 'SaaS',         icon: '☁️',  desc: 'Multi-tenant, subscriptions' },
  { id: 'mobile',   label: 'Mobile App',   icon: '📱', desc: 'iOS & Android with React Native' },
  { id: 'api',      label: 'API / Backend',icon: '⚙️',  desc: 'REST, GraphQL, microservices' },
  { id: 'monorepo', label: 'Monorepo',     icon: '📦', desc: 'Turborepo / Nx workspace' },
  { id: 'other',    label: 'Other',        icon: '💡', desc: 'Custom project type' },
]

const FRAMEWORKS: Record<string, string[]> = {
  web:      ['Next.js', 'Nuxt', 'SvelteKit', 'Remix', 'Astro', 'Vue', 'Angular', 'React (Vite)'],
  saas:     ['Next.js', 'Nuxt', 'SvelteKit', 'Remix'],
  mobile:   ['Expo', 'React Native CLI'],
  api:      ['Fastify', 'Express', 'NestJS', 'Hono', 'Bun/Elysia'],
  monorepo: ['Turborepo', 'Nx'],
  other:    ['Custom'],
}

const DEPLOY_OPTIONS = ['Vercel', 'Netlify', 'AWS', 'GCP', 'Azure', 'Cloudflare', 'Railway', 'Fly.io', 'Docker/Self-hosted', 'Other']

const AGENT_ROLES = [
  { id: 'ceo',      label: 'CEO / PM',        icon: '👔', color: '#f59e0b', desc: 'Creates the product plan: goals, user stories, features & constraints → outputs task.md' },
  { id: 'designer', label: 'UI/UX Designer',  icon: '🎨', color: '#ec4899', desc: 'Designs the design system and writes all UI component code files' },
  { id: 'dev',      label: 'Full-Stack Dev',  icon: '💻', color: '#6366f1', desc: 'Implements the complete production-ready codebase based on the plan' },
  { id: 'qa',       label: 'QA Engineer',     icon: '🔍', color: '#10b981', desc: 'Reviews the codebase, approves or lists specific issues for the next iteration' },
  { id: 'devops',   label: 'DevOps',          icon: '🚀', color: '#3b82f6', desc: 'Writes Dockerfile, CI/CD, nginx config, .env.example, README.md' },
]

interface FormData {
  name: string; projectType: string; framework: string
  description: string; targetAudience: string
  brandColors: { primary: string; secondary: string; accent: string }
  keyFeatures: string[]
  techStack: string[]
  deploymentTarget: string
  selectedAgentRoles: string[]
  logoFiles: File[]
}

const defaultForm: FormData = {
  name: '', projectType: '', framework: '',
  description: '', targetAudience: '',
  brandColors: { primary: '#6366f1', secondary: '#8b5cf6', accent: '#ec4899' },
  keyFeatures: [],
  techStack: [],
  deploymentTarget: '',
  selectedAgentRoles: ['ceo', 'designer', 'dev', 'qa'],
  logoFiles: [],
}

export default function NewProjectPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<FormData>(defaultForm)
  const [featureInput, setFeatureInput] = useState('')
  const [saving, setSaving] = useState(false)

  function patch(updates: Partial<FormData>) { setForm(f => ({ ...f, ...updates })) }

  const canNext: Record<number, boolean> = {
    0: !!form.projectType,
    1: !!form.name.trim() && !!form.framework,
    2: true, 3: true, 4: true, 5: form.selectedAgentRoles.length > 0, 6: true,
  }

  async function create() {
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name, description: form.description,
          projectType: form.projectType, framework: form.framework.toLowerCase().replace(/[^a-z0-9]/g, ''),
          targetAudience: form.targetAudience,
          brandColors: form.brandColors,
          keyFeatures: form.keyFeatures,
          techStack: form.techStack,
          deploymentTarget: form.deploymentTarget,
        }),
      })
      const project = await res.json()

      // Create selected agents
      for (let i = 0; i < form.selectedAgentRoles.length; i++) {
        const roleId = form.selectedAgentRoles[i]
        const roleInfo = AGENT_ROLES.find(r => r.id === roleId)
        await fetch(`/api/projects/${project.id}/agents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: roleInfo?.label ?? roleId,
            role: roleId,
            color: roleInfo?.color ?? '#6366f1',
            executionOrder: i,
          }),
        })
      }

      // Upload any staged logo/brand files
      if (form.logoFiles.length > 0) {
        const fd = new FormData()
        form.logoFiles.forEach((f) => fd.append('file', f))
        await fetch(`/api/projects/${project.id}/assets`, { method: 'POST', body: fd })
      }

      router.push(`/projects/${project.slug}`)
    } finally { setSaving(false) }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left sidebar — step list */}
      <div className="w-56 border-r border-border bg-card flex flex-col py-8 px-4 gap-1">
        <div className="mb-6 px-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">New Project</p>
        </div>
        {STEPS.map((label, i) => (
          <button key={i} onClick={() => i < step && setStep(i)}
            className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors text-left',
              i === step ? 'bg-primary/20 text-primary font-medium'
              : i < step  ? 'text-muted-foreground hover:bg-accent cursor-pointer'
              : 'text-muted-foreground/40 cursor-default'
            )}>
            <div className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
              i < step ? 'bg-primary text-white' : i === step ? 'ring-2 ring-primary text-primary' : 'bg-muted')}>
              {i < step ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            {label}
          </button>
        ))}
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-2xl space-y-6 animate-fade-in" key={step}>

            {/* Step 0 — Project Type */}
            {step === 0 && (
              <>
                <div><h1 className="text-3xl font-bold">What are you building?</h1>
                  <p className="text-muted-foreground mt-1">Choose your project type to get started.</p></div>
                <div className="grid grid-cols-2 gap-3">
                  {PROJECT_TYPES.map(t => (
                    <button key={t.id} onClick={() => patch({ projectType: t.id, framework: '' })}
                      className={cn('flex items-start gap-4 rounded-xl border-2 p-4 text-left transition-all hover:border-primary/50',
                        form.projectType === t.id ? 'border-primary bg-primary/10' : 'border-border')}>
                      <span className="text-3xl">{t.icon}</span>
                      <div><p className="font-semibold">{t.label}</p>
                        <p className="text-xs text-muted-foreground">{t.desc}</p></div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Step 1 — Basic Details */}
            {step === 1 && (
              <>
                <div><h1 className="text-3xl font-bold">Project details</h1>
                  <p className="text-muted-foreground mt-1">Give your project a name and description.</p></div>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Project name *</label>
                    <Input placeholder="My Awesome App" value={form.name} onChange={e => patch({ name: e.target.value })} className="text-lg h-11" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Description</label>
                    <textarea value={form.description} onChange={e => patch({ description: e.target.value })}
                      placeholder="A short description of what this project does and its goals..."
                      rows={3} className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium">Target audience</label>
                    <Input placeholder="e.g. Small business owners, developers, students..." value={form.targetAudience} onChange={e => patch({ targetAudience: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium">Framework *</label>
                    <div className="flex flex-wrap gap-2">
                      {(FRAMEWORKS[form.projectType] ?? []).map(fw => (
                        <button key={fw} onClick={() => patch({ framework: fw })}
                          className={cn('rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
                            form.framework === fw ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                          {fw}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 2 — Branding */}
            {step === 2 && (
              <>
                <div><h1 className="text-3xl font-bold">Brand & visuals</h1>
                  <p className="text-muted-foreground mt-1">Set your brand colors. Agents will use these when designing.</p></div>
                <div className="space-y-5">
                  {(['primary', 'secondary', 'accent'] as const).map(key => (
                    <div key={key} className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-lg border border-border overflow-hidden">
                        <input type="color" value={form.brandColors[key]}
                          onChange={e => patch({ brandColors: { ...form.brandColors, [key]: e.target.value } })}
                          className="h-full w-full cursor-pointer border-none p-0" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium capitalize">{key} color</p>
                        <p className="text-xs text-muted-foreground font-mono">{form.brandColors[key]}</p>
                      </div>
                      <div className="h-8 w-24 rounded-md" style={{ backgroundColor: form.brandColors[key] }} />
                    </div>
                  ))}
                  <AssetUploader
                    localFiles={form.logoFiles}
                    onLocalFilesChange={(files) => patch({ logoFiles: files })}
                  />
                </div>
              </>
            )}

            {/* Step 3 — Key Features */}
            {step === 3 && (
              <>
                <div><h1 className="text-3xl font-bold">Key features</h1>
                  <p className="text-muted-foreground mt-1">List the main features your app needs. Be specific — agents will implement these.</p></div>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input placeholder="e.g. User authentication with OAuth"
                      value={featureInput} onChange={e => setFeatureInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && featureInput.trim()) {
                        patch({ keyFeatures: [...form.keyFeatures, featureInput.trim()] }); setFeatureInput('') }}} />
                    <Button onClick={() => { if (featureInput.trim()) { patch({ keyFeatures: [...form.keyFeatures, featureInput.trim()] }); setFeatureInput('') }}}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-2 min-h-[120px]">
                    {form.keyFeatures.length === 0 && (
                      <p className="text-sm text-muted-foreground py-4 text-center border border-dashed border-border rounded-lg">
                        Add features above. Press Enter or click +
                      </p>
                    )}
                    {form.keyFeatures.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        <span className="flex-1 text-sm">{f}</span>
                        <button onClick={() => patch({ keyFeatures: form.keyFeatures.filter((_, j) => j !== i) })}
                          className="text-muted-foreground hover:text-red-400"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Step 4 — Tech Stack */}
            {step === 4 && (
              <>
                <div><h1 className="text-3xl font-bold">Tech preferences</h1>
                  <p className="text-muted-foreground mt-1">Any specific libraries or tools you want agents to use.</p></div>
                <div className="space-y-4">
                  {[
                    { label: 'Database', opts: ['PostgreSQL', 'MySQL', 'SQLite', 'MongoDB', 'Supabase', 'PlanetScale', 'Redis'] },
                    { label: 'Styling',  opts: ['Tailwind CSS', 'shadcn/ui', 'Styled Components', 'CSS Modules', 'Chakra UI', 'MUI'] },
                    { label: 'Auth',     opts: ['NextAuth.js', 'Clerk', 'Auth0', 'Supabase Auth', 'Custom JWT'] },
                    { label: 'Payments', opts: ['Stripe', 'Paddle', 'Lemonsqueezy', 'None'] },
                    { label: 'Deploy',   opts: DEPLOY_OPTIONS },
                  ].map(({ label, opts }) => (
                    <div key={label}>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">{label}</p>
                      <div className="flex flex-wrap gap-2">
                        {opts.map(opt => {
                          const active = form.techStack.includes(opt)
                          return (
                            <button key={opt} onClick={() => patch({ techStack: active ? form.techStack.filter(t => t !== opt) : [...form.techStack, opt] })}
                              className={cn('rounded-md border px-2.5 py-1 text-xs transition-colors',
                                active ? 'border-primary bg-primary/20 text-primary' : 'border-border text-muted-foreground hover:border-primary/50')}>
                              {opt}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 5 — Agent Team */}
            {step === 5 && (
              <>
                <div><h1 className="text-3xl font-bold">Build your team</h1>
                  <p className="text-muted-foreground mt-1">Select which AI agents to create. They'll work together in the order shown.</p></div>
                <div className="space-y-2">
                  {AGENT_ROLES.map((role, idx) => {
                    const active = form.selectedAgentRoles.includes(role.id)
                    return (
                      <button key={role.id} onClick={() => patch({
                        selectedAgentRoles: active
                          ? form.selectedAgentRoles.filter(r => r !== role.id)
                          : [...form.selectedAgentRoles, role.id]
                      })} className={cn('flex w-full items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
                        active ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/30')}>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-xl" style={{ backgroundColor: role.color + '33' }}>
                          {role.icon}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{role.label}</p>
                          <p className="text-xs text-muted-foreground">{role.desc}</p>
                        </div>
                        {active && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="rounded-full bg-muted px-2 py-0.5">Step {form.selectedAgentRoles.indexOf(role.id) + 1}</span>
                            <Check className="h-4 w-4 text-primary" />
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {/* Step 6 — Review */}
            {step === 6 && (
              <>
                <div><h1 className="text-3xl font-bold">Ready to launch 🚀</h1>
                  <p className="text-muted-foreground mt-1">Review your project configuration.</p></div>
                <div className="space-y-3">
                  {[
                    { label: 'Name', value: form.name },
                    { label: 'Type', value: `${form.projectType} / ${form.framework}` },
                    { label: 'Description', value: form.description || '—' },
                    { label: 'Target audience', value: form.targetAudience || '—' },
                    { label: 'Features', value: form.keyFeatures.length > 0 ? form.keyFeatures.join(', ') : '—' },
                    { label: 'Tech', value: form.techStack.length > 0 ? form.techStack.join(', ') : '—' },
                    { label: 'Team', value: form.selectedAgentRoles.map(r => AGENT_ROLES.find(a => a.id === r)?.label).join(' → ') },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-3 rounded-lg border border-border bg-card px-4 py-3">
                      <span className="w-32 shrink-0 text-xs font-medium text-muted-foreground uppercase tracking-wider pt-0.5">{label}</span>
                      <span className="text-sm">{value}</span>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    {Object.entries(form.brandColors).map(([key, color]) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <div className="h-5 w-5 rounded-full border border-border" style={{ backgroundColor: color }} />
                        <span className="text-xs text-muted-foreground capitalize">{key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          </div>
        </div>

        {/* Bottom nav */}
        <div className="border-t border-border bg-card px-8 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep(s => s - 1)} disabled={step === 0}>Back</Button>
          <div className="flex items-center gap-2">
            {STEPS.map((_, i) => (
              <div key={i} className={cn('h-1.5 w-6 rounded-full transition-colors', i === step ? 'bg-primary' : i < step ? 'bg-primary/40' : 'bg-muted')} />
            ))}
          </div>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canNext[step]}>
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={create} disabled={saving} className="gap-2">
              {saving ? 'Creating...' : '🚀 Create project'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
