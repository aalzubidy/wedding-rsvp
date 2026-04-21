const { neon } = require('@neondatabase/serverless');

const MAX_GUESTS = 25;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { attending, added_by, names } = body ?? {};

  // Validate added_by (UUID from client)
  if (
    !added_by ||
    typeof added_by !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(added_by)
  ) {
    return res.status(400).json({ error: 'Invalid submission identifier.' });
  }

  if (typeof attending !== 'boolean') {
    return res.status(400).json({ error: '"attending" must be a boolean.' });
  }

  if (!Array.isArray(names) || names.length === 0) {
    return res.status(400).json({ error: 'At least one name is required.' });
  }

  const cleanNames = names.map(n => (typeof n === 'string' ? n.trim() : '')).filter(n => n.length > 0);

  if (cleanNames.length === 0) {
    return res.status(400).json({ error: 'At least one valid name is required.' });
  }

  if (attending && cleanNames.length > MAX_GUESTS) {
    return res.status(400).json({ error: `A maximum of ${MAX_GUESTS} guests is allowed per submission.` });
  }

  if (!attending && cleanNames.length !== 1) {
    return res.status(400).json({ error: 'Exactly one name is required when declining.' });
  }

  // Best-effort IP geolocation — never blocks or fails the submission
  let ip_address = null;
  let city = null;
  let country = null;
  try {
    const raw = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || null;
    ip_address = raw ? raw.split(',')[0].trim() : null;
    if (ip_address) {
      const geo = await fetch(`https://ipinfo.io/${ip_address}/json`);
      if (geo.ok) {
        const data = await geo.json();
        city = data.city || null;
        country = data.country || null;
      }
    }
  } catch {
    // silently ignore geo errors
  }

  const sql = neon(process.env.POSTGRES_URL);

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS guests (
        id           SERIAL PRIMARY KEY,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        name         TEXT NOT NULL,
        attending    BOOLEAN NOT NULL,
        added_by     TEXT NOT NULL,
        ip_address   TEXT,
        city         TEXT,
        country      TEXT
      )
    `;

    // Insert one row per name
    for (const name of cleanNames) {
      await sql`
        INSERT INTO guests (name, attending, added_by, ip_address, city, country)
        VALUES (${name}, ${attending}, ${added_by}, ${ip_address}, ${city}, ${country})
      `;
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('RSVP insert error:', err);
    return res.status(500).json({ error: 'Failed to save your RSVP. Please try again.' });
  }
};
