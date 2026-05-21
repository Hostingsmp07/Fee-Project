const { getDb } = require('../config/db');

exports.getSessions = async (req, res) => {
  try {
    const db = await getDb();
    const sessions = await db.all(
      'SELECT * FROM sessions WHERE userId = ? ORDER BY loggedAt DESC',
      [req.user.id]
    );
    res.json(sessions);
  } catch (err) {
    console.error('Get sessions error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.createSession = async (req, res) => {
  const { planId, durationSeconds, note } = req.body || {};

  if (!planId || !durationSeconds) {
    return res.status(400).json({ message: 'planId and durationSeconds are required.' });
  }

  try {
    const db = await getDb();
    const loggedAt = new Date().toISOString();

    const ownedPlan = await db.get(
      'SELECT id FROM plans WHERE id = ? AND userId = ?',
      [planId, req.user.id]
    );
    if (!ownedPlan) {
      return res.status(400).json({ message: 'Invalid plan for this user.' });
    }

    const result = await db.run(
      `INSERT INTO sessions (userId, planId, durationSeconds, loggedAt, note)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.id,
        planId,
        Number(durationSeconds),
        loggedAt,
        note || '',
      ]
    );

    const session = await db.get('SELECT * FROM sessions WHERE id = ?', [result.lastID]);
    res.status(201).json(session);
  } catch (err) {
    console.error('Create session error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};