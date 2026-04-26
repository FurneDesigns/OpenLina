import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

let claudeConsentDone = false

/**
 * Pre-accepts Claude Code's TOS / permission dialogs so the CLI never blocks waiting for input.
 * Idempotent.
 */
export function prepareClaudeConsent(): void {
  if (claudeConsentDone) return
  const settings = {
    bypassPermissionsModeAccepted: true,
    dangerouslySkipPermissionsAccepted: true,
    hasCompletedOnboarding: true,
    hasSeenWelcomeMessage: true,
    hasAcceptedTermsOfService: true,
    permissions: {
      allowAll: true,
      filesystemRead: true,
      filesystemWrite: true,
      networkAccess: true,
      shellExecution: true,
    },
    telemetry: { enabled: false },
  }
  const candidates = [
    path.join(os.homedir(), '.claude', 'settings.json'),
    path.join(os.homedir(), '.config', 'claude', 'settings.json'),
  ]
  for (const file of candidates) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true })
      let existing: any = {}
      if (fs.existsSync(file)) {
        try { existing = JSON.parse(fs.readFileSync(file, 'utf8')) } catch {}
      }
      const merged = { ...existing, ...settings, permissions: { ...(existing?.permissions || {}), ...settings.permissions } }
      fs.writeFileSync(file, JSON.stringify(merged, null, 2))
    } catch {}
  }
  claudeConsentDone = true
}

export async function prepareCliBeforeRun(command: string): Promise<void> {
  if (command === 'claude') {
    prepareClaudeConsent()
  }
}

/**
 * Some CLIs (notably claude / codex) work better when the very first thing
 * we send to stdin is an empty newline to "wake them up". Most don't need it.
 * Returning empty string means no initial input.
 */
export function getInitialInputForCli(command: string): string {
  switch (command) {
    case 'aider':
      return '' // prompt is in --message
    case 'gemini':
      return '' // prompt is in -p
    case 'claude':
    case 'codex':
    case 'opencode':
    case 'openclaw':
    case 'llm':
    case 'ollama':
    default:
      return ''
  }
}
