const request = require('supertest');
const app = require('../server');

// Mock the entire aiController module
jest.mock('../controllers/aiController', () => ({
  suggestGoal: async (req, res) => {
    const { topic } = req.body || {};
    if (!topic) return res.status(400).json({ message: 'Topic is required.' });
    res.json({ suggestedHours: 25 });
  },
  generatePlan: async (req, res) => {
    const { topic, sessionsCount } = req.body || {};
    if (!topic) return res.status(400).json({ message: 'Topic is required.' });
    const count = Number(sessionsCount) || 6;
    res.json({
      totalHours: 12,
      sessions: Array.from({ length: count }).map((_, i) => ({
        title: `Session ${i + 1}`,
        durationHours: 12 / count,
        description: `Study "${topic}"`,
      })),
    });
  },
  chatStream: async (req, res) => {
    const { message } = req.body || {};
    if (!message) return res.status(400).json({ message: 'Message is required.' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: 'Hello! ' })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'chunk', content: 'How can I help?' })}\n\n`);
    res.write(`data: ${JSON.stringify({ type: 'done', fullContent: 'Hello! How can I help?' })}\n\n`);
    res.end();
  },
}));

describe('AI API', () => {
  let token;

  beforeAll(async () => {
    const email = `ai_test_${Date.now()}@example.com`;
    const password = 'password123';

    await request(app)
      .post('/api/auth/register')
      .send({ email, password });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    token = loginRes.body.token;
  });

  it('should suggest study hours', async () => {
    const res = await request(app)
      .post('/api/ai/suggest')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'Javascript', difficulty: 'easy' });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('suggestedHours', 25);
  });

  it('should generate a study plan', async () => {
    const res = await request(app)
      .post('/api/ai/generate')
      .set('Authorization', `Bearer ${token}`)
      .send({ topic: 'React', sessionsCount: 2 });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('totalHours', 12);
    expect(res.body.sessions).toHaveLength(2);
  });

  it('should return 400 if topic is missing', async () => {
    const res = await request(app)
      .post('/api/ai/suggest')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.statusCode).toEqual(400);
  });

  it('should stream chat responses via SSE', async () => {
    const res = await request(app)
      .post('/api/ai/chat')
      .set('Authorization', `Bearer ${token}`)
      .send({ message: 'Hello', history: [] });

    expect(res.statusCode).toEqual(200);
    expect(res.headers['content-type']).toContain('text/event-stream');
    expect(res.text).toContain('chunk');
    expect(res.text).toContain('done');
    expect(res.text).toContain('Hello! How can I help?');
  });
});
