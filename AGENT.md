---
name: Wedding RSVP
description: A minimal wedding RSVP website. Single-page RSVP form with a password-gated admin report page.
---

## Project Overview
A simple wedding RSVP site for a friend. Guests visit a single page, read the wedding details, and submit their attendance. The owner visits a separate admin page to view a report of all responses.

## Plan
Plan file is plan.md `plan.md`, read it for more details.

## Stack
- **Frontend**: Plain HTML, CSS, Vanilla JS — no framework, no build step
- **Backend**: Vercel Serverless Functions (Node.js)
- **Database**: Neon (serverless Postgres), connected via Vercel native integration
- **Hosting**: Vercel (free tier)

## Phases
- **Phase 1**: RSVP page (`index.html`) + API endpoint (`api/rsvp.js`)
- **Phase 2**: Admin report page (`admin.html`) + API endpoint (`api/admin.js`)

## Key Files
- `index.html` — Wedding info + RSVP card (your name, yes/no, party names)
- `admin.html` — Password-gated report: summary counts + full guest list
- `style.css` — Shared styles
- `api/rsvp.js` — POST endpoint: validates and inserts guest rows
- `api/admin.js` — GET endpoint: returns all rows as JSON (password-gated)

## Database
Single table `guests` with columns: `id`, `submitted_at`, `name`, `attending`, `added_by`, `ip_address`, `city`, `country`.
One row per person. For a group RSVP, multiple rows share the same `added_by`.
`ip_address`, `city`, and `country` are best-effort (nullable) — collected silently from the request IP.

## Environment Variables (set in Vercel dashboard)
- `POSTGRES_URL` — auto-set by the Neon integration
- `ADMIN_PASSWORD` — manually set; used to gate the admin API

## Constraints
- No email notifications
- No RSVP editing or deletion
- No JS framework
- VPS is static-only (Nginx); Vercel handles all backend logic
