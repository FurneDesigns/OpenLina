export type ProjectType = 'web' | 'mobile' | 'saas' | 'api' | 'monorepo' | 'other'
export type Framework =
  | 'nextjs' | 'nuxt' | 'sveltekit' | 'remix' | 'astro'
  | 'react' | 'vue' | 'angular' | 'expo' | 'react-native'
  | 'express' | 'fastify' | 'nestjs' | 'hono'
  | 'turborepo' | 'nx' | 'other'

export type I18nStrategy = 'none' | 'path' | 'subdomain' | 'query' | 'dynamic'

export interface Project {
  id: string
  name: string
  projectType: ProjectType
  framework: Framework
  rootPath: string
  i18nStrategy: I18nStrategy
  i18nLocales?: string[]
  defaultLocale?: string
  extraConfig?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
