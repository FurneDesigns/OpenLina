# CarDealer — Product Vision

## Vision
A fast, professional personal car showcase site. Visitors land, browse vehicles, and contact the owner directly — no middlemen, no platform fees, no competitor ads.

## Target Audience
- Local used-car buyers (mobile-first, low-friction browsing)
- Owner: non-technical, wants to manage listings without touching code

## Success Metrics
| Metric | Target |
|---|---|
| Time-to-contact | < 30s from landing |
| Page load (mobile 4G) | < 2s |
| External paid dependencies | 0 |
| Add new listing (owner, no code) | < 5 min — Iteration 2 |
| Lighthouse mobile score | ≥ 90 |

## Iteration 1 — Showcase ✅ Complete
- Homepage: hero banner + car grid
- Car detail page: photos, specs, price, contact CTA
- Static JSON data source (`/data/cars.json`)
- Contact section (phone / email / WhatsApp)
- Mobile-first Tailwind UI
- Next.js App Router, TypeScript

## Iteration 2 — Admin Panel 🔄 In Progress
- Password-protected `/admin` route (iron-session)
- Car list with edit/delete actions
- Add/edit form for all car fields
- Image upload → `/public/cars/<slug>/`
- Sold toggle, delete confirmation (P1)
- Site config editor (P1)

## Iteration 3 — SEO (Planned)
- Meta tags, structured data, sitemap

## Iteration 4 — Trust (Planned)
- Real photo galleries, WhatsApp lead capture, sold badges

## Stack
- Framework: Next.js 16 (App Router)
- Styling: Tailwind CSS
- Data: `/data/cars.json` flat file (no database)
- Images: local `/public/cars/` folder
- Auth: iron-session (env var password)
