// /api/parse-task.js
// Vercel Serverless Function - Calls Claude API to parse voice/text into structured task

// Simple in-memory rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT = 30;
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000;

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimit = rateLimitMap.get(userId);
  
  if (!userLimit || now - userLimit.timestamp > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(userId, { count: 1, timestamp: now });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }
  
  if (userLimit.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }
  
  userLimit.count++;
  return { allowed: true, remaining: RATE_LIMIT - userLimit.count };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, userId = 'anonymous' } = req.body;

    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return res.status(429).json({ 
        error: 'Daily limit reached. Upgrade to Pro for unlimited tasks!',
        code: 'RATE_LIMITED'
      });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `You are a task parser for an ADHD-friendly task manager. Parse this input into a structured task.

Input: "${text}"

Today's date: ${new Date().toISOString().split('T')[0]}

Return ONLY valid JSON (no markdown, no explanation) with this structure:
{
  "name": "Clear, actionable task name",
  "project": "Project name if mentioned, otherwise 'Inbox'",
  "deadline": "ISO date string (YYYY-MM-DDTHH:mm:ss.sssZ)",
  "priority": "high" | "medium" | "low",
  "chunks": [
    {"name": "Small actionable step", "duration": minutes_as_number},
    {"name": "Next small step", "duration": minutes_as_number}
  ]
}

Rules:
- Break task into 3-5 small, ADHD-friendly chunks
- Each chunk should be completable in 2-30 minutes
- Use encouraging, friendly language in chunk names
- If no deadline mentioned, set to end of today (17:00)
- If "tomorrow" mentioned, set to tomorrow 17:00
- Keep chunk names short but specific`
          }
        ],
      }),
    });

    if (!response.ok) {
      console.error('Claude API error:', await response.text());
      return res.status(500).json({ error: 'AI processing failed' });
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    let parsedTask;
    try {
      parsedTask = JSON.parse(content);
    } catch (e) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedTask = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response');
      }
    }

    const task = {
      id: generateUUID(),
      ...parsedTask,
      chunks: parsedTask.chunks.map(chunk => ({
        id: generateUUID(),
        ...chunk,
        completed: false,
      })),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    return res.status(200).json({ 
      task,
      rateLimitRemaining: rateLimit.remaining,
    });

  } catch (error) {
    console.error('Parse task error:', error);
    return res.status(500).json({ error: 'Failed to parse task' });
  }
}
