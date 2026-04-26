export interface ScaffoldCommand {
  command: string
  args: string[]
  timeoutMs: number
}

export function getScaffoldCommand(framework: string | undefined | null): ScaffoldCommand | null {
  const fw = (framework || '').toLowerCase()
  switch (fw) {
    case 'nextjs':
    case 'next':
      return {
        command: 'npx',
        args: ['create-next-app@latest', '.', '--ts', '--tailwind', '--eslint', '--app', '--src-dir', '--import-alias', '@/*', '--use-npm', '--yes'],
        timeoutMs: 10 * 60_000,
      }
    case 'vite':
      return {
        command: 'npm',
        args: ['create', 'vite@latest', '.', '--', '--template', 'react-ts', '--yes'],
        timeoutMs: 5 * 60_000,
      }
    case 'nuxt':
      return {
        command: 'npx',
        args: ['nuxi@latest', 'init', '.', '--package-manager', 'npm', '--git-init', 'false'],
        timeoutMs: 8 * 60_000,
      }
    case 'astro':
      return {
        command: 'npm',
        args: ['create', 'astro@latest', '.', '--', '--template', 'minimal', '--install', '--no-git', '--yes'],
        timeoutMs: 8 * 60_000,
      }
    case 'remix':
      return {
        command: 'npx',
        args: ['create-remix@latest', '.', '--no-git-init', '--install', '--template', 'remix-run/remix/templates/remix'],
        timeoutMs: 8 * 60_000,
      }
    default:
      return null
  }
}
