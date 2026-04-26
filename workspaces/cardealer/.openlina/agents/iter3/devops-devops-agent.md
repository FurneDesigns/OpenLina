<!-- run=run_moen2hgulcr7yreg iter=3 role=devops name=devops agent ts=2026-04-25T19:17:18.571Z -->
# devops agent (devops) — iteration 3

Done. Here's what was delivered for iter 3:

**Files changed:**

| File | What |
|---|---|
| `next.config.ts` | Added `headers()` — 4 security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy) on every route |
| `public/robots.txt` | New — crawlers allowed on public pages, `/admin` and `/api/` disallowed |
| `ecosystem.config.js` | New — PM2 process config so the owner can run `pm2 start ecosystem.config.js` for persistent hosting |

**CI was left unchanged** — the existing lint → type-check → build pipeline is correct and the SESSION_SECRET placeholder is already 42 chars (satisfies iron-session's 32-char minimum).

**Key note for the dev agent:** robots.txt is live but has no `Sitemap:` line yet — that points to a dynamic `src/app/sitemap.ts` route the dev agent should implement as the iter 3 SEO task.
[?1006l[?1003l[?1002l[?1000l[>4m[<u[?1004l[?2031l[?2004l[?25h]9;4;0;]0;[?25h