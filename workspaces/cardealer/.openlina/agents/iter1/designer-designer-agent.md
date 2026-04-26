<!-- run=run_moen2hgulcr7yreg iter=1 role=designer name=designer agent ts=2026-04-25T18:01:23.894Z -->
# designer agent (designer) — iteration 1

Done. Here's what was produced:

---

**Design tokens** — `src/app/globals.css` extended with a full `@theme inline` token set:
- `brand-*` (50–900) — semantic alias for blue; `brand-600 = #2563eb` matches all existing `blue-600` usage so no component changes are needed
- `surface-white/light/muted/dark/darker` — the five surface levels used across the site
- `sold-bg/sold-text` and `available-bg/available-text` — status tokens
- `border`, `muted`, `card` semantic tokens
- Radius, shadow, and a `.focus-ring` utility class for keyboard accessibility

**Base components** — `src/components/ui/`:

| File | What it provides |
|---|---|
| `Button.tsx` | `primary` / `secondary` / `ghost` / `danger` × `sm` / `md` / `lg` |
| `Badge.tsx` | `sold` / `available` / `new` / `tag` — backed by design tokens |
| `Card.tsx` | White card wrapper, optional padding |
| `Input.tsx` | Styled text/number input with `brand-500` focus ring |
| `Label.tsx` | Form label with consistent spacing |
| `index.ts` | Barrel export — `import { Button, Badge, … } from '@/components/ui'` |

The dev agent's admin panel work should import exclusively from `@/components/ui` to stay consistent. The `output: "export"` blocker in `next.config.ts` still needs removing before API routes work (P0-0).
[?1006l[?1003l[?1002l[?1000l[>4m[<u[?1004l[?2031l[?2004l[?25h]9;4;0;]0;[?25h