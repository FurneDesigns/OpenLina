'use client'
import { ReactNode, useMemo } from 'react'

const COLOR_FG: Record<number, string> = {
  30: '#3b3b3b', 31: '#ff5577', 32: '#3ddc84', 33: '#f5a623', 34: '#5b9dff', 35: '#c277ff', 36: '#3acccd', 37: '#e6e8ec',
  90: '#8a93a3', 91: '#ff7799', 92: '#5fe0a0', 93: '#f7c25c', 94: '#7ab1ff', 95: '#d699ff', 96: '#5fd5d6', 97: '#ffffff',
}

interface Span { text: string; color?: string; bold?: boolean; underline?: boolean }

// Strip every non-color escape sequence. We only keep SGR (color/style) which ends in lowercase 'm'.
// This catches all the variants: standard CSI, private CSI with ?/</>/= prefixes,
// OSC, DCS, charset selection, keypad mode, bracketed paste, etc.
function stripTuiNoise(s: string): string {
  return s
    // OSC ... (BEL or ST)
    .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
    // DCS / SOS / PM / APC ... ST
    .replace(/\x1b[PX^_][^\x1b]*\x1b\\/g, '')
    // CSI with private prefix (?, <, >, =) — anything, including SGR-looking ones with prefix
    .replace(/\x1b\[[?<>=][0-9;:]*[\x20-\x2f]*[A-Za-z@`]/g, '')
    // CSI without prefix, ending in any letter EXCEPT lowercase 'm' (which is SGR color)
    .replace(/\x1b\[[0-9;:]*[\x20-\x2f]*[A-Za-ln-zA-Z@`]/g, '')
    // 7-bit single-shift / charset selection / keypad
    .replace(/\x1b[=>]/g, '')
    .replace(/\x1b[()*+][A-B0-9]/g, '')
    // Other lone control chars (keep \t \n \r)
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
}

function parse(text: string): Span[] {
  const cleaned = stripTuiNoise(text || '')
  // Process \r (carriage return without \n): keep only the part after the last \r in a line
  const lines = cleaned.split('\n').map((line) => {
    const i = line.lastIndexOf('\r')
    return i >= 0 ? line.slice(i + 1) : line
  })
  // Collapse runs of 3+ blank lines to 2, and trim leading/trailing blanks
  const collapsed: string[] = []
  let blanks = 0
  for (const ln of lines) {
    if (ln.trim() === '') { blanks++; if (blanks <= 2) collapsed.push('') }
    else { blanks = 0; collapsed.push(ln) }
  }
  while (collapsed.length && collapsed[0].trim() === '') collapsed.shift()
  while (collapsed.length && collapsed[collapsed.length - 1].trim() === '') collapsed.pop()
  const joined = collapsed.join('\n')

  const out: Span[] = []
  let cur: Span = { text: '' }
  const re = /\x1b\[([0-9;]*)m/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(joined)) !== null) {
    if (match.index > last) cur.text += joined.slice(last, match.index)
    if (cur.text) { out.push(cur); cur = { text: '', color: cur.color, bold: cur.bold, underline: cur.underline } }
    const codes = (match[1] || '0').split(';').map((s) => parseInt(s, 10))
    for (const code of codes) {
      if (code === 0) { cur.color = undefined; cur.bold = false; cur.underline = false }
      else if (code === 1) cur.bold = true
      else if (code === 4) cur.underline = true
      else if (code === 22) cur.bold = false
      else if (code === 24) cur.underline = false
      else if (COLOR_FG[code]) cur.color = COLOR_FG[code]
    }
    last = re.lastIndex
  }
  if (last < joined.length) cur.text += joined.slice(last)
  if (cur.text) out.push(cur)
  return out
}

export function AnsiText({ text, className }: { text: string; className?: string }) {
  const spans = useMemo(() => parse(text || ''), [text])
  return (
    <pre className={`whitespace-pre-wrap break-words font-mono text-xs leading-relaxed ${className || ''}`}>
      {spans.map((s, i) => (
        <span key={i} style={{ color: s.color, fontWeight: s.bold ? 600 : undefined, textDecoration: s.underline ? 'underline' : undefined }}>
          {s.text}
        </span>
      ))}
    </pre>
  )
}
