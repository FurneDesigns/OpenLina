import type { Template } from './types'

export const viteTemplate: Template = {
  id: 'vite',
  name: 'Vite + React + TS',
  description: 'Vite React TS starter (fallback).',
  framework: 'vite',
  files: [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'app', private: true, type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: { vite: '^5', '@vitejs/plugin-react': '^4', typescript: '^5', '@types/react': '^18', '@types/react-dom': '^18' },
      }, null, 2),
    },
    { path: 'tsconfig.json', content: JSON.stringify({ compilerOptions: { target: 'es2020', jsx: 'react-jsx', module: 'esnext', moduleResolution: 'bundler', strict: true, esModuleInterop: true } }, null, 2) },
    { path: 'index.html', content: '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>' },
    { path: 'src/main.tsx', content: "import React from 'react'\nimport { createRoot } from 'react-dom/client'\nimport App from './App'\ncreateRoot(document.getElementById('root')!).render(<App />)\n" },
    { path: 'src/App.tsx', content: 'export default function App() { return <div style={{padding:24,fontFamily:"sans-serif"}}>Hello from OpenLina</div> }\n' },
    { path: 'vite.config.ts', content: "import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })\n" },
  ],
}
