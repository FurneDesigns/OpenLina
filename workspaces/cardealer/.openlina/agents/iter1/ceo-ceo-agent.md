<!-- run=run_moen2hgulcr7yreg iter=1 role=ceo name=ceo agent ts=2026-04-25T17:55:17.499Z -->
# ceo agent (ceo) — iteration 1

---

**CarDealer — CEO Plan (Iteration 2)**

**Vision:** Own the buyer relationship — fast, ad-free, zero platform dependency. Buyers land and contact the owner directly; no marketplace fees, no competitor listings beside yours.

**Audience:**
- **Primary:** Local used-car buyers — mobile-first, want to find a car and tap to call in under 30 seconds.
- **Internal:** A non-technical owner who manages listings from a browser, not a terminal.

**Success metrics:**

| Metric | Target | Iter 1 |
|---|---|---|
| Time-to-contact from landing | < 30 s | ✅ |
| Mobile page load (4G) | < 2 s | ✅ |
| Lighthouse mobile | ≥ 90 | ✅ |
| Paid external dependencies | 0 | ✅ |
| Add listing + 3 photos, no code | < 5 min | **Iter 2 goal** |

**Roadmap:**

| # | Theme | Status |
|---|---|---|
| 1 | Showcase — grid, detail, contact | ✅ Done |
| 2 | Self-service admin panel | **Now** |
| 3 | SEO | Planned |
| 4 | Trust signals (sold badges, galleries) | Planned |

**Iter 2 exit criterion:** Owner opens `/admin`, logs in, adds a fully-described listing with 3+ photos in under 5 minutes. No terminal, no deploy step.

**Hard blocker (first task):** Remove `output: "export"` from `next.config.ts` — it disables API routes and makes the admin panel impossible.

**P0:** Auth gate → car list view → add/edit form → image upload.
**P1:** Sold toggle, delete, site config editor.
**Out of scope (iter 2):** Multi-user roles, public listing creation, analytics, payments.
[?1006l[?1003l[?1002l[?1000l[>4m[<u[?1004l[?2031l[?2004l[?25h]9;4;0;]0;[?25h