interface PromptPattern {
  test: RegExp
  reply: string
  // Each pattern fires at most once per session (by pattern index)
  oncePerSession?: boolean
}

const COMMON_PATTERNS: PromptPattern[] = [
  { test: /(\(y\/n\)|\[y\/n\]|continue\?|proceed\?|are you sure)/i, reply: 'Y\r', oncePerSession: false },
  { test: /press (any key|enter) to continue/i, reply: '\r' },
  { test: /accept (the )?(terms|tos|license)/i, reply: 'Y\r', oncePerSession: true },
  { test: /trust (this )?(folder|directory|workspace)/i, reply: 'Y\r', oncePerSession: true },
  { test: /enable .* (telemetry|analytics)/i, reply: 'N\r', oncePerSession: true },
]

const CLAUDE_PATTERNS: PromptPattern[] = [
  { test: /bypass.*permissions/i, reply: '2\r', oncePerSession: true },
  { test: /select.*model/i, reply: '\r', oncePerSession: true },
  { test: /onboarding|welcome to claude/i, reply: '\r', oncePerSession: true },
]

const CODEX_PATTERNS: PromptPattern[] = [
  { test: /full.?auto/i, reply: 'Y\r', oncePerSession: true },
]

const AIDER_PATTERNS: PromptPattern[] = [
  { test: /add .* to the chat\?/i, reply: 'Y\r' },
  { test: /run shell command/i, reply: 'Y\r' },
]

function patternsFor(command: string): PromptPattern[] {
  const list = [...COMMON_PATTERNS]
  switch (command) {
    case 'claude': list.push(...CLAUDE_PATTERNS); break
    case 'codex': list.push(...CODEX_PATTERNS); break
    case 'aider': list.push(...AIDER_PATTERNS); break
  }
  return list
}

export class PromptResponder {
  private patterns: PromptPattern[]
  private fired = new Set<number>()
  private buffer = ''

  constructor(command: string) {
    this.patterns = patternsFor(command)
  }

  /**
   * Feed bytes from the PTY. If a pattern matches, calls send(reply) and returns true.
   */
  feed(chunk: string, send: (reply: string) => void): boolean {
    this.buffer = (this.buffer + chunk).slice(-2000)
    let any = false
    for (let i = 0; i < this.patterns.length; i++) {
      const p = this.patterns[i]
      if (p.oncePerSession && this.fired.has(i)) continue
      if (p.test.test(this.buffer)) {
        send(p.reply)
        if (p.oncePerSession) this.fired.add(i)
        // Drop matched portion to avoid re-firing in the same buffer
        this.buffer = ''
        any = true
        break
      }
    }
    return any
  }
}
