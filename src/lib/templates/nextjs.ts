import type { Template } from './types'

export const nextjsTemplate: Template = {
  id: 'nextjs',
  name: 'Next.js (minimal)',
  description: 'Next.js 14 + Tailwind starter (fallback if create-next-app fails).',
  framework: 'nextjs',
  files: [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'app',
        private: true,
        scripts: { dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' },
        dependencies: { next: '14.2.18', react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: { typescript: '^5', '@types/node': '^22', '@types/react': '^18', autoprefixer: '^10', postcss: '^8', tailwindcss: '^3' },
      }, null, 2),
    },
    {
      path: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'es2020', module: 'esnext', moduleResolution: 'bundler', strict: true, esModuleInterop: true, jsx: 'preserve', noEmit: true, isolatedModules: true, skipLibCheck: true, plugins: [{ name: 'next' }], paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules', '.next'],
      }, null, 2),
    },
    { path: 'next-env.d.ts', content: '/// <reference types="next" />\n' },
    { path: 'tailwind.config.ts', content: "import type { Config } from 'tailwindcss'\nconst config: Config = { content: ['./src/**/*.{ts,tsx}'], theme: { extend: {} }, plugins: [] }\nexport default config\n" },
    { path: 'postcss.config.js', content: 'module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }\n' },
    { path: 'src/app/globals.css', content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' },
    { path: 'src/app/layout.tsx', content: "import './globals.css'\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (<html lang=\"en\"><body>{children}</body></html>)\n}\n" },
    { path: 'src/app/page.tsx', content: 'export default function Page() { return (<main className="p-8 text-2xl font-bold">Hello from OpenLina</main>) }\n' },
  ],
}
