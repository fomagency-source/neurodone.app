// /api/parse-task.js
// Vercel Serverless Function - Calls Claude API to parse voice/text into structured task

export const config = {
  runtime: 'edge',
};

// Simple in-memory rate limiting (use Redis/Upstash for production)
const rateLimitMap = new Map();
const RATE_LIMIT = 30; // tasks per day per user
const RATE_LIMIT_WINDOW = 24 * 60 * 60 * 1000; // 24 hours

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

export default async function handler(req) {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { text, userId = 'anonymous' } = await req.json();

    if (!text || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'No text provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Check rate limit
    const rateLimit = checkRateLimit(userId);
    if (!rateLimit.allowed) {
      return new Response(JSON.stringify({ 
        error: 'Daily limit reached. Upgrade to Pro for unlimited tasks!',
        code: 'RATE_LIMITED'
      }), {
        status: 429,
        headers: { 
          'Content-Type': 'application/json',
          'X-RateLimit-Remaining': '0',
        },
      });
    }

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Fast & cheap for parsing
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
- If day name mentioned (Friday, Monday), calculate the date
- Keep chunk names short but specific`
          }
        ],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Claude API error:', error);
      return new Response(JSON.stringify({ error: 'AI processing failed' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    const content = data.content[0].text;
    
    // Parse Claude's response
    let parsedTask;
    try {
      parsedTask = JSON.parse(content);
    } catch (e) {
      // Try to extract JSON if wrapped in markdown
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedTask = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response');
      }
    }

    // Add IDs and metadata
    const task = {
      id: crypto.randomUUID(),
      ...parsedTask,
      chunks: parsedTask.chunks.map(chunk => ({
        id: crypto.randomUUID(),
        ...chunk,
        completed: false,
      })),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    return new Response(JSON.stringify({ 
      task,
      rateLimitRemaining: rateLimit.remaining,
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-RateLimit-Remaining': String(rateLimit.remaining),
      },
    });

  } catch (error) {
    console.error('Parse task error:', error);
    return new Response(JSON.stringify({ error: 'Failed to parse task' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
