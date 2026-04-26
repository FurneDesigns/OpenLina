export const REVIEWER_DEFAULT_PROMPT = `You are a strict code reviewer.
- Read the diff and verification report.
- If anything is broken, missing, or below quality, output exactly:
  VERDICT: REQUEST_CHANGES
  followed by a short bullet list of issues.
- Otherwise output exactly:
  VERDICT: APPROVE
  followed by a one-line confirmation.
Never approve when verification has failures.`

export interface ParsedReview {
  verdict: 'approve' | 'request_changes'
  feedback: string
}

export function parseReviewVerdict(text: string): ParsedReview {
  const upper = text.toUpperCase()
  if (upper.includes('VERDICT: REQUEST_CHANGES')) {
    return { verdict: 'request_changes', feedback: text }
  }
  if (upper.includes('VERDICT: APPROVE')) {
    return { verdict: 'approve', feedback: text }
  }
  // Fallback heuristics
  if (/looks good|lgtm|approve/i.test(text) && !/issue|fail|missing/i.test(text)) {
    return { verdict: 'approve', feedback: text }
  }
  return { verdict: 'request_changes', feedback: text }
}

export function buildReviewerUserPrompt(args: {
  workerName: string
  workerRole: string
  workerOutput: string
  verificationReport?: string
  attempt: number
  maxAttempts: number
}): string {
  const parts: string[] = []
  parts.push(`You are reviewing the work of agent "${args.workerName}" (role=${args.workerRole}).`)
  parts.push(`This is review attempt ${args.attempt} of ${args.maxAttempts}.`)
  if (args.verificationReport) {
    parts.push('\nVerification report:')
    parts.push(args.verificationReport)
  }
  parts.push('\nWorker output:')
  parts.push('```\n' + (args.workerOutput || '').slice(0, 60_000) + '\n```')
  parts.push('\nNow respond with exactly one VERDICT line.')
  return parts.join('\n')
}
