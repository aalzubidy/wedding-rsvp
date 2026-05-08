# Plan: Wedding RSVP Website

## Context
- VPS: Nginx, static files only — no backend runtime available
- User has Vercel free account
- ~50–200 RSVP responses expected
- Phase 1: RSVP page. Phase 2: Admin report page.
- Admin auth: simple hardcoded password (env var)

## Stack Decision
- **Frontend**: Plain HTML + CSS + Vanilla JS (no framework)
- **Hosting**: Vercel (static + serverless functions)
- **Database**: Neon (serverless Postgres) via Vercel native integration
  - Free tier (0.5 GB storage, generous for this)
  - SQL-native, handles concurrent writes properly (unlike SQLite file)
  - Vercel connects to it in one click from dashboard

## Storage Rationale
- SQLite file: won't work on Vercel (no persistent FS)
- JSON/CSV: same problem + concurrency corruption risk
- Neon Postgres: free, serverless-safe, simple SQL, concurrent-safe

## File Structure
```
wedding-rsvp/
├── index.html          # Main RSVP page
├── admin.html          # Admin report page (Phase 2)
├── style.css           # Shared styles
├── api/
│   ├── rsvp.js         # POST /api/rsvp — save response
│   └── admin.js        # GET /api/admin?password=xxx — fetch all RSVPs
├── vercel.json         # (optional, may not be needed)
└── .env.local          # ADMIN_PASSWORD, POSTGRES_URL (not committed)
```

## DB Schema
```sql
CREATE TABLE IF NOT EXISTS guests (
  id           SERIAL PRIMARY KEY,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  name         TEXT NOT NULL,
  attending    BOOLEAN NOT NULL,
  added_by     TEXT NOT NULL,  -- UUID of the person who submitted the form
  ip_address   TEXT,           -- best-effort, nullable
  city         TEXT,           -- best-effort via ip-api.com, nullable
  country      TEXT            -- best-effort via ip-api.com, nullable
);
```

> **Note:** `ip_address`, `city`, and `country` are collected silently at submission time using the requester's IP and a free geo-lookup (ip-api.com). All three default to `NULL` if lookup fails — this never blocks or fails a submission.

### How rows are written
- Yes RSVP by "Alice" with party [Alice, Bob, Carol]:
  - Row 1: name=Alice, attending=true, added_by=Alice
  - Row 2: name=Bob, attending=true, added_by=Alice
  - Row 3: name=Carol, attending=true, added_by=Alice
- No RSVP by "Dave":
  - Row 1: name=Dave, attending=false, added_by=Dave
**The added by is referencing the user id and not the name, in case someone with the same name is there.**

## Phase 1: RSVP Page (index.html)
- Wedding info: names, venue, date/time (placeholders for now)
- Card UI: Yes/No radio buttons
- If Yes: number of guests (1–10 max), names input field (one per guest, dynamic)
- If No: just submit → thank you message shown inline
- Submits to POST /api/rsvp
- Vanilla JS handles show/hide of fields, fetch() for submission

## API: POST /api/rsvp (api/rsvp.js)
- Accepts: { attending: bool, added_by: string, names?: string[] }
- Validates: added_by always required; if attending=true, names must be non-empty array
- If attending=true: inserts one row per name, all with added_by
- If attending=false: inserts one row with name=added_by, attending=false
- Returns: 200 OK or 400/500 with error message

## Env Vars (set in Vercel dashboard → Project → Settings → Environment Variables)
- `POSTGRES_URL` — auto-set when you connect Neon via Vercel dashboard (you never type this)
- `ADMIN_PASSWORD` — you choose, set manually

## Phase 2: Admin Report (admin.html + api/admin.js)
- admin.html has a password form
- On submit, calls GET /api/admin?password=xxx
- api/admin.js: checks password against ADMIN_PASSWORD env var
- Returns: all RSVPs as JSON
- admin.html renders: summary table (total attending, total guests, no-RSVPs), full guest list

## Admin Auth
- Password stored as ADMIN_PASSWORD env var in Vercel
- Simple query param check in api/admin.js
- Not high-security — just enough to gate the data

## Verification
1. Deploy to Vercel, visit the URL, submit a Yes RSVP with 2 guests
2. Submit a No RSVP
3. Visit /admin.html, enter password, confirm both entries show
4. Test concurrent submissions (open 2 tabs, submit simultaneously)

## Exclusions
- No email notifications
- No RSVP editing/deletion (admin only sees data, no CRUD)
- No auth beyond simple password on admin
- No framework (React, Vue, etc.)
- VPS not used (Vercel handles everything)

## Phase 3: Mobile-First CSS Redesign

### Problem
The site is embedded in a Cloudflare-hosted iframe. In that context:
- The viewport meta tag (`width=device-width`) does not reflect the actual phone screen size
- `vw`-based units (`clamp(1.9rem, 7vw, ...)`) calculate against the iframe width, not the phone
- `@media (max-width: 480px)` queries never fire because the iframe is wider than 480px
- Result: text and UI elements render too small to read on mobile

### Approach
Rewrite `style.css` to be **truly mobile-first with fixed sizing**. The site is a simple single-column form with no desktop-specific layout, so a single design works for all screen sizes:

1. **Replace all viewport-relative sizing** — Remove all `clamp()` with `vw` units. Use fixed `rem`/`px` values sized for ~375px phone screens (but readable at any width).
2. **Container fills available space** — Remove the hard `max-width: 680px` cap. Let the container naturally fill the iframe/viewport with generous padding. Override Bootstrap's responsive `max-width` with `max-width: 100% !important`.
3. **Mobile-first container query strategy** — Use `@container` queries only to **widen** spacing on larger screens (the opposite of current approach).
4. **Larger typography** — Body font `1.125rem`, headings `2.6rem`/`1.8rem`, labels `0.875rem`. All fixed `rem` sizes.
5. **Touch-friendly targets** — All interactive elements at least `44px` tall, generous padding on inputs and buttons.
6. **Radio buttons always stacked** — Vertical stack works at all widths, no side-by-side needed.
7. **Auto-scale JavaScript** — Detects iframe/screen width mismatch (`window.innerWidth > screen.width * 1.3`) and applies `document.documentElement.style.zoom` to scale content to fill the phone screen. Fallback uses `transform: scale()` for Firefox. Applied to both `index.html` and `admin.html`.
8. **Admin table** — Already has `overflow-x: auto`; ensure search/export work on narrow screens.

### Files Modified
- `style.css` — Full rewrite (same design tokens, colors, fonts, larger fixed sizing, container max-width override)
- `index.html` — Cache buster update + auto-scale script
- `admin.html` — Cache buster update + auto-scale script + touch-friendly inline style adjustments
- `PLAN.md` — This section

### What Does NOT Change
- All HTML structure in `index.html` and `admin.html`
- All JavaScript (i18n, form logic, admin logic, API calls)
- All design tokens (colors, fonts, border radius, shadows)
- Bootstrap CSS remains loaded
- No changes to any API files
