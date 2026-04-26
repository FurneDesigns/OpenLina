import type { Template } from './types'

export const nodeApiTemplate: Template = {
  id: 'node-api',
  name: 'Node API (Express)',
  description: 'Minimal Node + Express + TS API.',
  framework: 'node-api',
  files: [
    { path: 'package.json', content: JSON.stringify({
      name: 'api', private: true, type: 'module',
      scripts: { dev: 'tsx src/index.ts', build: 'tsc -p .', start: 'node dist/index.js' },
      dependencies: { express: '^4.21.2' },
      devDependencies: { typescript: '^5', tsx: '^4', '@types/express': '^4', '@types/node': '^22' },
    }, null, 2) },
    { path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'es2020', module: 'esnext', moduleResolution: 'bundler', outDir: 'dist', strict: true, esModuleInterop: true } }, null, 2) },
    { path: 'src/index.ts', content: "import express from 'express'\nconst app = express()\napp.get('/', (_req, res) => res.json({ ok: true }))\napp.listen(3000, () => console.log('listening on :3000'))\n" },
  ],
}
