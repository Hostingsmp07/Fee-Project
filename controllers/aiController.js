const https = require('https');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama3-70b-8192';

function groqRequest(body, onChunk) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);

    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      if (res.statusCode !== 200) {
        let errBody = '';
        res.on('data', (d) => { errBody += d; });
        res.on('end', () => {
          reject(new Error(`Groq API error ${res.statusCode}: ${errBody}`));
        });
        return;
      }

      if (onChunk) {
        // Streaming mode — parse SSE
        let buffer = '';
        let fullText = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                onChunk(delta);
              }
            } catch (_) {}
          }
        });

        res.on('end', () => {
          // Process remaining buffer
          if (buffer.startsWith('data: ')) {
            const data = buffer.slice(6).trim();
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  fullText += delta;
                  onChunk(delta);
                }
              } catch (_) {}
            }
          }
          resolve(fullText);
        });
      } else {
        // Non-streaming mode
        let body = '';
        res.on('data', (d) => { body += d; });
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            resolve(parsed.choices?.[0]?.message?.content || '');
          } catch (e) {
            reject(new Error('Failed to parse Groq response'));
          }
        });
      }
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Streaming chat endpoint using Server-Sent Events
exports.chatStream = async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'Message is required.' });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ message: 'AI service not configured. Set GROQ_API_KEY in .env' });
  }

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  try {
    const messages = [
      {
        role: 'system',
        content: `You are AI Scholar, a friendly and knowledgeable AI study assistant. You help students with:
- Explaining concepts across any subject (CS, math, science, languages, etc.)
- Solving problems step by step
- Suggesting study strategies and resources
- Answering questions clearly and concisely

Keep responses helpful, educational, and well-structured. Use markdown formatting when it improves readability (bold, code blocks, lists). Be encouraging but not overly verbose.`,
      },
    ];

    // Add conversation history
    if (Array.isArray(history)) {
      history.forEach((msg) => {
        messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: msg.content });
      });
    }

    messages.push({ role: 'user', content: message.trim() });

    const fullText = await groqRequest(
      { model: GROQ_MODEL, messages, stream: true },
      (chunk) => {
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      }
    );

    res.write(`data: ${JSON.stringify({ type: 'done', fullContent: fullText })}\n\n`);
    res.end();
  } catch (err) {
    console.error('AI chatStream error', err.message || err);
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'AI service temporarily unavailable. Please try again.' })}\n\n`);
    res.end();
  }
};

exports.suggestGoal = async (req, res) => {
  const { topic, difficulty } = req.body || {};

  if (!topic) {
    return res.status(400).json({ message: 'Topic is required.' });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ message: 'AI service not configured. Set GROQ_API_KEY in .env' });
  }

  try {
    const text = await groqRequest({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You respond ONLY with valid JSON. No markdown, no explanation, just raw JSON.',
        },
        {
          role: 'user',
          content: `You are helping a student estimate realistic total study hours for a topic.

Return ONLY valid JSON in this exact shape:
{ "suggestedHours": number }

Topic: "${topic}"
Difficulty: "${difficulty || 'medium'}"
Respond with a positive integer between 1 and 300.`,
        },
      ],
      temperature: 0.3,
    });

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { suggestedHours: 10 };
    }

    if (typeof parsed.suggestedHours !== 'number') {
      parsed.suggestedHours = 10;
    }

    res.json({ suggestedHours: parsed.suggestedHours });
  } catch (err) {
    console.error('AI suggestGoal error', err);
    res.status(500).json({ message: 'AI service unavailable.' });
  }
};

exports.generatePlan = async (req, res) => {
  const { topic, difficulty, sessionsCount } = req.body || {};

  if (!topic) {
    return res.status(400).json({ message: 'Topic is required.' });
  }

  if (!GROQ_API_KEY) {
    return res.status(500).json({ message: 'AI service not configured. Set GROQ_API_KEY in .env' });
  }

  try {
    const count = Number(sessionsCount) || 6;

    const text = await groqRequest({
      model: GROQ_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You respond ONLY with valid JSON. No markdown, no explanation, just raw JSON.',
        },
        {
          role: 'user',
          content: `You are an AI study coach.

Generate a session-by-session outline to learn the topic below.

Return ONLY valid JSON in this exact shape:
{
  "totalHours": number,
  "sessions": [
    {
      "title": string,
      "durationHours": number,
      "description": string
    }
  ]
}

Topic: "${topic}"
Difficulty: "${difficulty || 'medium'}"
Target number of sessions: ${count}
Make sure sessions.length is ${count}.
All numbers must be positive.`,
        },
      ],
      temperature: 0.3,
    });

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        totalHours: 10,
        sessions: Array.from({ length: count }).map((_, i) => ({
          title: `Session ${i + 1}`,
          durationHours: 10 / count,
          description: `Study "${topic}" (placeholder).`,
        })),
      };
    }

    if (!Array.isArray(parsed.sessions)) {
      parsed.sessions = [];
    }

    res.json(parsed);
  } catch (err) {
    console.error('AI generatePlan error', err);
    res.status(500).json({ message: 'AI service unavailable.' });
  }
};
