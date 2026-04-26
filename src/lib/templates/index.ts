import fs from 'node:fs'
import path from 'node:path'
import { nextjsTemplate } from './nextjs'
import { viteTemplate } from './vite'
import { nodeApiTemplate } from './node-api'
import type { Template } from './types'

export const TEMPLATES: Record<string, Template> = {
  nextjs: nextjsTemplate,
  vite: viteTemplate,
  'node-api': nodeApiTemplate,
}

export function listTemplates(): { id: string; name: string; description: string; framework: string }[] {
  return Object.values(TEMPLATES).map((t) => ({ id: t.id, name: t.name, description: t.description, framework: t.framework }))
}

export function applyTemplate(workspacePath: string, templateId: string): string[] {
  const t = TEMPLATES[templateId]
  if (!t) throw new Error(`unknown template: ${templateId}`)
  fs.mkdirSync(workspacePath, { recursive: true })
  const written: string[] = []
  for (const f of t.files) {
    const full = path.join(workspacePath, f.path)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, f.content)
    written.push(full)
  }
  return written
}
