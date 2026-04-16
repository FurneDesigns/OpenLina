import { NextResponse } from 'next/server'
import { execSync } from 'child_process'

const TOOLS = [
  { id: 'claude', label: 'Claude Code',     checkCmd: 'claude --version',  versionRegex: /[\d.]+/ },
  { id: 'codex',  label: 'Codex CLI',       checkCmd: 'codex --version',   versionRegex: /[\d.]+/ },
  { id: 'llm',    label: 'LLM CLI',         checkCmd: 'llm --version',     versionRegex: /[\d.]+/ },
  { id: 'aider',  label: 'Aider',           checkCmd: 'aider --version',   versionRegex: /[\d.]+/ },
  { id: 'sgpt',   label: 'Shell-GPT',       checkCmd: 'sgpt --version',    versionRegex: /[\d.]+/ },
]

function checkTool(checkCmd: string, versionRegex: RegExp): { installed: boolean; version?: string } {
  try {
    const out = execSync(checkCmd, { timeout: 5000, stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim()
    const match = out.match(versionRegex)
    return { installed: true, version: match?.[0] }
  } catch {
    return { installed: false }
  }
}

export async function GET() {
  const results = TOOLS.map(({ id, label, checkCmd, versionRegex }) => ({
    id,
    label,
    ...checkTool(checkCmd, versionRegex),
  }))
  return NextResponse.json(results)
}
