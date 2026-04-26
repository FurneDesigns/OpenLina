'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label } from '@/components/ui/input'

export default function ProjectWizard() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [framework, setFramework] = useState('nextjs')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    try {
      const r = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, description, framework }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error)
      router.push(`/projects/${j.data.slug}/agents`)
    } catch (err: any) { setError(err?.message || String(err)) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">New project</h1>
      <Card>
        <CardHeader><div className="font-medium">Basics</div></CardHeader>
        <CardBody>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="desc">Description</Label>
              <Textarea id="desc" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="framework">Framework</Label>
              <select id="framework" value={framework} onChange={(e) => setFramework(e.target.value)}
                className="h-9 w-full rounded-md border border-border bg-surfaceAlt px-3 text-sm">
                <option value="nextjs">Next.js</option>
                <option value="vite">Vite + React</option>
                <option value="nuxt">Nuxt</option>
                <option value="astro">Astro</option>
                <option value="remix">Remix</option>
                <option value="node-api">Node API (Express)</option>
              </select>
            </div>
            {error && <div className="text-sm text-danger">{error}</div>}
            <div className="flex justify-end">
              <Button type="submit" disabled={submitting}>{submitting ? 'Creating…' : 'Create project'}</Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
