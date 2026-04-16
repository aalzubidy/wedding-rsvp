const { neon } = require('@neondatabase/serverless');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.query;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.POSTGRES_URL);

  try {
    // Fetch all guests ordered by submission time
    const guests = await sql`
      SELECT id, submitted_at, name, attending, added_by
      FROM guests
      ORDER BY submitted_at ASC
    `;

    // Build a submissions list: one entry per unique added_by,
    // with the first name in that group as the "submitter" name.
    const submissionMap = new Map();
    for (const row of guests) {
      if (!submissionMap.has(row.added_by)) {
        submissionMap.set(row.added_by, {
          added_by: row.added_by,
          first_name: row.name,
          submitted_at: row.submitted_at,
        });
      }
    }

    const submissions = Array.from(submissionMap.values());

    return res.status(200).json({ guests, submissions });
  } catch (err) {
    console.error('Admin fetch error:', err);
    return res.status(500).json({ error: 'Failed to load RSVP data.' });
  }
};
