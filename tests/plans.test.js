const request = require('supertest');
const app = require('../server');
const { getDb } = require('../config/db');

describe('Plans API', () => {
  let db;
  let token;
  let userId;

  beforeAll(async () => {
    process.env.DB_FILE = 'test_database_plans.sqlite';
    db = await getDb();

    // Create a test user and get token
    const email = `plan_test_${Date.now()}@example.com`;
    const password = 'password123';
    
    await request(app)
      .post('/api/auth/register')
      .send({ email, password });
    
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });
    
    token = loginRes.body.token;
    userId = loginRes.body.user.id;
  });

  afterAll(async () => {
    await db.run('DELETE FROM users');
    await db.run('DELETE FROM plans');
  });

  let planId;

  it('should create a new plan', async () => {
    const res = await request(app)
      .post('/api/plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Learn Jest',
        goalHours: 10,
        difficulty: 'hard'
      });
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('title', 'Learn Jest');
    planId = res.body.id;
  });

  it('should get plans for the user', async () => {
    const res = await request(app)
      .get('/api/plans')
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('should update a plan', async () => {
    const res = await request(app)
      .put(`/api/plans/${planId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Master Jest',
        goalHours: 20
      });
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('title', 'Master Jest');
    expect(res.body).toHaveProperty('goalHours', 20);
  });

  it('should delete a plan', async () => {
    const res = await request(app)
      .delete(`/api/plans/${planId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(res.statusCode).toEqual(204);
  });
});
