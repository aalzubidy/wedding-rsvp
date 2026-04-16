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

  const sql = neon(process.env.POSTGRES_URL);

  try {
    // Ensure table exists
    await sql`
      CREATE TABLE IF NOT EXISTS guests (
        id          SERIAL PRIMARY KEY,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        name        TEXT NOT NULL,
        attending   BOOLEAN NOT NULL,
        added_by    TEXT NOT NULL
      )
    `;

    // Insert one row per name
    for (const name of cleanNames) {
      await sql`
        INSERT INTO guests (name, attending, added_by)
        VALUES (${name}, ${attending}, ${added_by})
      `;
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('RSVP insert error:', err);
    return res.status(500).json({ error: 'Failed to save your RSVP. Please try again.' });
  }
};
