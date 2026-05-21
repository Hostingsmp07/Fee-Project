const request = require('supertest');
const app = require('../server');
const { getDb } = require('../config/db');

describe('Auth API', () => {
  let db;

  beforeAll(async () => {
    process.env.DB_FILE = 'test_database.sqlite';
    db = await getDb();
  });

  afterAll(async () => {
    // Clean up test database if needed
    await db.run('DELETE FROM users');
  });

  const testUser = {
    email: `test_${Date.now()}@example.com`,
    password: 'password123'
  };

  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    
    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', testUser.email);
  });

  it('should login an existing user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send(testUser);
    
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', testUser.email);
  });

  it('should fail login with wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword'
      });
    
    expect(res.statusCode).toEqual(401);
    expect(res.body).toHaveProperty('message', 'Invalid credentials.');
  });
});
