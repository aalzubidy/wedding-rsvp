# Wedding RSVP

Simple wedding RSVP site. Guests fill out a form; the owner views responses on a password-gated admin page.

**Stack:** Plain HTML/CSS/JS · Vercel Serverless Functions · Neon (Postgres)

---

## Run locally

**Prerequisites:** Node.js 18+

```bash
npm install
```

Create `.env.local` (already done — never commit this file):

```
POSTGRES_URL="your-neon-connection-string"
ADMIN_PASSWORD="your-admin-password"
```

Start the dev server (Vercel CLI handles the API functions locally):

```bash
npx vercel dev --local
```

Open [http://localhost:3000](http://localhost:3000) for the RSVP page and [http://localhost:3000/admin.html](http://localhost:3000/admin.html) for the admin report.

---

## Deploy to Vercel

1. **Install the Vercel CLI** (one-time):
   ```bash
   npm install -g vercel
   ```

2. **Log in:**
   ```bash
   vercel login
   ```

3. **Deploy** (first time — follow the prompts to link your account and project):
   ```bash
   vercel
   ```
   For production:
   ```bash
   vercel --prod
   ```

4. **Set environment variables in the Vercel dashboard:**
   - Go to your project → Settings → Environment Variables
   - Add `POSTGRES_URL` (copy from your Neon dashboard, or connect Neon via the Vercel integration which sets it automatically)
   - Add `ADMIN_PASSWORD` (pick any strong password)

5. **Set up the database** — run this SQL once in the Neon console (or via `psql`):
   ```sql
   CREATE TABLE IF NOT EXISTS guests (
     id SERIAL PRIMARY KEY,
     submitted_at TIMESTAMPTZ DEFAULT NOW(),
     name TEXT NOT NULL,
     attending BOOLEAN NOT NULL,
     added_by TEXT NOT NULL
   );
   ```

After that, every `git push` to the linked branch auto-deploys via Vercel.

---

## Notes on `.env.local`

The Postgres connection string (`POSTGRES_URL`) comes from Neon. The one in `.env.local` uses `sslmode=require&channel_binding=require` — both are required by Neon and work fine with the `@neondatabase/serverless` driver already listed in `package.json`. No changes needed.
