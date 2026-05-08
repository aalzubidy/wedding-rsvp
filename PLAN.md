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
The site was too small on mobile phones — text, buttons, and inputs were hard to read. The viewport meta tag and fixed `rem` sizes weren't enough to make the site feel "phone-sized." Previous auto-scale JS hacks for iframe embedding didn't trigger reliably.

### Approach
Rewrote `style.css` with significantly larger fixed sizing so the site is immediately readable on ~375px phone screens without any zoom tricks. A single design works at all screen widths — no media queries, no container queries, no auto-scale JavaScript needed.

1. **Larger typography** — Body `1.25rem` (20px), h1 `3.2rem`, h2 `2.2rem`, labels `1rem`, inputs `1.125rem`.
2. **Full-width container** — `width: 92%`, `max-width: 680px`. Content fills most of the screen on mobile.
3. **Bigger touch targets** — Inputs/buttons `min-height: 52–58px`, radio labels `56px`. Generous padding on all interactive elements.
4. **Removed auto-scale JS** — No longer needed since the design is naturally phone-sized. Removed from both `index.html` and `admin.html`.
5. **Removed container queries** — Not needed; single design at all widths.
6. **Larger admin page** — Search, export, filter banner, summary stats all scaled up to match.

### Files Modified
- `style.css` — Full rewrite: larger fixed rem sizes, full-width container, bigger touch targets
- `index.html` — Cache buster `v=9`, removed Bootstrap padding classes, removed auto-scale script
- `admin.html` — Cache buster `v=9`, removed auto-scale script, bumped all inline style sizes
- `PLAN.md` — This section

### What Did NOT Change
- All HTML structure in `index.html` and `admin.html`
- All JavaScript (i18n, form logic, admin logic, API calls)
- All design tokens (colors, fonts, border radius, shadows)
- Bootstrap CSS remains loaded
- No changes to any API files
