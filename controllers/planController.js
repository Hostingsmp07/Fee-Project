const { getDb } = require('../config/db');

exports.getPlans = async (req, res) => {
  try {
    const db = await getDb();
    const plans = await db.all(
      'SELECT * FROM plans WHERE userId = ? ORDER BY createdAt DESC',
      [req.user.id]
    );
    res.json(plans);
  } catch (err) {
    console.error('Get plans error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.createPlan = async (req, res) => {
  const { title, goalHours, difficulty } = req.body || {};

  if (!title || !goalHours) {
    return res.status(400).json({ message: 'Title and goalHours are required.' });
  }

  try {
    const db = await getDb();
    const createdAt = new Date().toISOString();

    const result = await db.run(
      `INSERT INTO plans (userId, title, goalHours, difficulty, createdAt)
       VALUES (?, ?, ?, ?, ?)`,
      [
        req.user.id,
        title,
        Number(goalHours),
        difficulty || 'medium',
        createdAt,
      ]
    );

    const plan = await db.get('SELECT * FROM plans WHERE id = ?', [result.lastID]);
    res.status(201).json(plan);
  } catch (err) {
    console.error('Create plan error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.updatePlan = async (req, res) => {
  const { id } = req.params;
  const { title, goalHours, difficulty } = req.body || {};

  try {
    const db = await getDb();
    const existing = await db.get(
      'SELECT * FROM plans WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );

    if (!existing) {
      return res.status(404).json({ message: 'Plan not found.' });
    }

    const newTitle = title ?? existing.title;
    const newGoalHours =
      goalHours !== undefined ? Number(goalHours) : existing.goalHours;
    const newDifficulty = difficulty ?? existing.difficulty;

    await db.run(
      `UPDATE plans
       SET title = ?, goalHours = ?, difficulty = ?
       WHERE id = ? AND userId = ?`,
      [newTitle, newGoalHours, newDifficulty, id, req.user.id]
    );

    const updated = await db.get('SELECT * FROM plans WHERE id = ?', [id]);
    res.json(updated);
  } catch (err) {
    console.error('Update plan error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

exports.deletePlan = async (req, res) => {
  const { id } = req.params;

  try {
    const db = await getDb();
    const result = await db.run(
      'DELETE FROM plans WHERE id = ? AND userId = ?',
      [id, req.user.id]
    );

    if (result.changes === 0) {
      return res.status(404).json({ message: 'Plan not found.' });
    }

    res.status(204).send();
  } catch (err) {
    console.error('Delete plan error', err);
    res.status(500).json({ message: 'Internal server error.' });
  }
};