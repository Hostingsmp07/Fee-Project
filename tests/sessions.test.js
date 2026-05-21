const request = require('supertest');
const app = require('../server');
const { getDb } = require('../config/db');

describe('Sessions API', () => {
  let db;
  let token;
  let userId;
  let planId;

  beforeAll(async () => {
    process.env.DB_FILE = 'test_database_sessions.sqlite';
    db = await getDb();

    // Create a test user and get token
    const email = `session_test_${Date.now()}@example.com`;
    const password = 'password123';
    
    await request(app)
      .post('/api/auth/register')
      .send({ email, password });
    
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    
    token = loginRes.body.token;
    userId = loginRes.body.user.id;

    // Create a plan for the sessions
    const planRes = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Session Test Plan',
        goalHours: 5
      });
    planId = planRes.body.id;
  });

  afterAll(async () => {
    await db.run('DELETE FROM users');
    await db.run('DELETE FROM plans');
    await db.run('DELETE FROM sessions');
  });

  it('should create a new session', async () => {
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planId: planId,
        durationSeconds: 3600
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('durationSeconds', 3600);
    expect(res.body).toHaveProperty('planId', planId);
  });

  it('should get sessions for the user', async () => {
    const res = await request(app)
      .get('/api/sessions')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should fail to create a session for a plan not owned by user', async () => {
    // This would require another user's plan, which we can simulate by using a non-existent planId
    const res = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        planId: 99999,
        durationSeconds: 1800
      });
    
    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('message', 'Invalid plan for this user.');
  });
});
