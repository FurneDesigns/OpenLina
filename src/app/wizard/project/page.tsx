'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { WizardShell } from '@/components/wizard/WizardShell'
import { useWizardStore } from '@/store/useWizardStore'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'

const STEPS = ['Type', 'Framework', 'i18n', 'Directory', 'Done']

const PROJECT_TYPES = [
  { id: 'web', label: 'Web App', icon: '🌐' },
  { id: 'mobile', label: 'Mobile App', icon: '📱' },
  { id: 'saas', label: 'SaaS Platform', icon: '☁️' },
  { id: 'api', label: 'API / Backend', icon: '⚙️' },
  { id: 'monorepo', label: 'Monorepo', icon: '📦' },
  { id: 'other', label: 'Other', icon: '💡' },
]

const FRAMEWORKS: Record<string, Array<{ id: string; label: string }>> = {
  web: [
    { id: 'nextjs', label: 'Next.js' }, { id: 'nuxt', label: 'Nuxt' },
    { id: 'sveltekit', label: 'SvelteKit' }, { id: 'remix', label: 'Remix' },
    { id: 'astro', label: 'Astro' }, { id: 'react', label: 'React (Vite)' },
    { id: 'vue', label: 'Vue' }, { id: 'angular', label: 'Angular' },
  ],
  mobile: [
    { id: 'expo', label: 'Expo' }, { id: 'react-native', label: 'React Native CLI' },
  ],
  saas: [
    { id: 'nextjs', label: 'Next.js' }, { id: 'nuxt', label: 'Nuxt' },
    { id: 'sveltekit', label: 'SvelteKit' },
  ],
  api: [
    { id: 'express', label: 'Express' }, { id: 'fastify', label: 'Fastify' },
    { id: 'nestjs', label: 'NestJS' }, { id: 'hono', label: 'Hono' },
  ],
  monorepo: [
    { id: 'turborepo', label: 'Turborepo' }, { id: 'nx', label: 'Nx' },
  ],
  other: [{ id: 'other', label: 'Other' }],
}

const I18N_STRATEGIES = [
  { id: 'none', label: 'None', desc: 'No i18n needed' },
  { id: 'path', label: 'Path prefix', desc: '/en/page, /es/page' },
  { id: 'subdomain', label: 'Subdomain', desc: 'en.myapp.com, es.myapp.com' },
  { id: 'query', label: 'Query param', desc: '?lang=es' },
  { id: 'dynamic', label: 'Dynamic (runtime)', desc: 'Client detects locale, loads JSON' },
]

const COMMON_LOCALES = ['en', 'es', 'fr', 'de', 'pt', 'it', 'ja', 'zh', 'ko', 'ar']

export default function ProjectWizardPage() {
  const router = useRouter()
  const { projectStep, setProjectStep, projectData, setProjectData } = useWizardStore()
  const [saving, setSaving] = useState(false)
  const [localeInput, setLocaleInput] = useState('')

  function next() { if (projectStep < STEPS.length - 1) setProjectStep(projectStep + 1) }
  function back() { if (projectStep > 0) setProjectStep(projectStep - 1) }

  async function saveProject() {
    setSaving(true)
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectData.name || 'My Project',
          projectType: projectData.projectType || 'web',
          framework: projectData.framework || 'other',
          rootPath: projectData.rootPath || process.cwd?.() || '~',
          i18nStrategy: projectData.i18nStrategy || 'none',
          i18nLocales: projectData.i18nLocales,
          defaultLocale: projectData.defaultLocale,
        }),
      })
      if (res.ok) router.push('/canvas')
    } finally {
      setSaving(false)
    }
  }

  const isLast = projectStep === STEPS.length - 1
  const frameworks = FRAMEWORKS[projectData.projectType ?? 'web'] ?? FRAMEWORKS.other

  function toggleLocale(locale: string) {
    const current = projectData.i18nLocales ?? []
    const updated = current.includes(locale)
      ? current.filter((l) => l !== locale)
      : [...current, locale]
    setProjectData({ i18nLocales: updated })
  }

  return (
    <WizardShell
      steps={STEPS}
      currentStep={projectStep}
      onBack={projectStep > 0 ? back : undefined}
      onNext={isLast ? saveProject : next}
      nextLabel={isLast ? 'Create project' : 'Continue'}
      isLoading={saving}
    >
      {/* Step 0: Project Type */}
      {projectStep === 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">What are you building?</h2>
          <div className="grid grid-cols-3 gap-3">
            {PROJECT_TYPES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setProjectData({ projectType: t.id, framework: undefined })}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-colors',
                  projectData.projectType === t.id
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50 hover:text-foreground',
                )}
              >
                <span className="text-2xl">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
          <div className="pt-2">
            <label className="mb-1 block text-xs text-muted-foreground">Project name</label>
            <Input
              placeholder="My awesome project"
              value={projectData.name ?? ''}
              onChange={(e) => setProjectData({ name: e.target.value })}
            />
          </div>
        </div>
      )}

      {/* Step 1: Framework */}
      {projectStep === 1 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Which framework?</h2>
          <div className="flex flex-wrap gap-2">
            {frameworks.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setProjectData({ framework: f.id })}
                className={cn(
                  'rounded-lg border px-4 py-2 text-sm font-medium transition-colors',
                  projectData.framework === f.id
                    ? 'border-primary bg-primary/20 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: i18n */}
      {projectStep === 2 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Translations & i18n</h2>
          <div className="space-y-2">
            {I18N_STRATEGIES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setProjectData({ i18nStrategy: s.id })}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors',
                  projectData.i18nStrategy === s.id
                    ? 'border-primary bg-primary/20'
                    : 'border-border hover:border-primary/50',
                )}
              >
                <div
                  className={cn(
                    'h-3 w-3 rounded-full border-2',
                    projectData.i18nStrategy === s.id ? 'border-primary bg-primary' : 'border-muted-foreground',
                  )}
                />
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </button>
            ))}
          </div>
          {projectData.i18nStrategy && projectData.i18nStrategy !== 'none' && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Select locales</p>
              <div className="flex flex-wrap gap-2">
                {COMMON_LOCALES.map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => toggleLocale(l)}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-mono transition-colors',
                      (projectData.i18nLocales ?? []).includes(l)
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/50',
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Step 3: Directory */}
      {projectStep === 3 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Project directory</h2>
          <p className="text-sm text-muted-foreground">
            Where is your project located on disk?
          </p>
          <Input
            placeholder="/home/user/my-project"
            value={projectData.rootPath ?? ''}
            onChange={(e) => setProjectData({ rootPath: e.target.value })}
          />
        </div>
      )}

      {/* Step 4: Done */}
      {projectStep === 4 && (
        <div className="space-y-4 text-center">
          <div className="text-4xl">🎉</div>
          <h2 className="text-2xl font-bold">Project configured!</h2>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p><span className="text-foreground font-medium">{projectData.name}</span> — {projectData.projectType} / {projectData.framework}</p>
            <p>i18n: <span className="text-foreground">{projectData.i18nStrategy ?? 'none'}</span>
              {projectData.i18nLocales?.length ? ` (${projectData.i18nLocales.join(', ')})` : ''}
            </p>
          </div>
        </div>
      )}
    </WizardShell>
  )
}
