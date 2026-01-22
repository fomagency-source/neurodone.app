// Vercel Serverless Function for Claude API
// /api/parse.js

export const config = {
  runtime: 'edge', // Use edge for faster response
  regions: ['fra1'], // Frankfurt - close to EU users
};

// Rate limiting store (in production, use Redis/KV)
const rateLimitStore = new Map();

export default async function handler(request) {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await request.json();
    const { input, mode, userProjects, context } = body;

    if (!input || input.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Input required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get client IP for rate limiting
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown';

    // Check rate limit (100 calls per day per IP)
    if (!checkRateLimit(clientIP, 100)) {
      return new Response(JSON.stringify({ 
        error: 'Rate limit exceeded',
        message: 'You have reached the daily limit. Try again tomorrow or upgrade to Pro.'
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Build prompt based on mode
    const systemPrompt = buildSystemPrompt(mode, userProjects, context);
    const userPrompt = buildUserPrompt(input, mode);

    // Call Claude API (Haiku for cost efficiency)
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022', // Cheapest, fastest model
        max_tokens: 500, // Limit output for cost control
        system: systemPrompt,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      })
    });

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text();
      console.error('Claude API error:', error);
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content[0]?.text || '';

    // Parse Claude's response
    const parsedResult = parseClaudeResponse(responseText, mode);

    // Track usage for analytics
    incrementRateLimit(clientIP);

    return new Response(JSON.stringify(parsedResult), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'X-AI-Model': 'claude-3-5-haiku',
        'X-Parse-Mode': mode || 'parse'
      }
    });

  } catch (error) {
    console.error('Parse API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// ============================================
// PROMPT ENGINEERING
// ============================================

function buildSystemPrompt(mode, userProjects, context) {
  const projectList = userProjects?.length > 0 
    ? `User's existing projects: ${userProjects.join(', ')}`
    : 'User has no existing projects yet.';

  const baseContext = `
You are an ADHD-friendly task parsing assistant for NEURODONE app.
Current date/time: ${context?.currentDate || new Date().toISOString()}
Timezone: ${context?.timezone || 'UTC'}
${projectList}

IMPORTANT RULES:
1. Be concise - output ONLY valid JSON
2. Break tasks into 3-5 small, actionable chunks (ADHD-friendly)
3. Each chunk should take 5-25 minutes max
4. Use encouraging, simple language
5. If project name matches existing project, use exact spelling
6. Deadlines should be realistic - don't assume "today" unless specified
`;

  if (mode === 'coach') {
    return baseContext + `

COACH MODE: User is doing a brain dump. Extract ALL tasks mentioned.
Return array of tasks, each with name, project, deadline, and chunks.
Prioritize by urgency if mentioned.`;
  }

  return baseContext + `

PARSE MODE: Extract single task from user input.
Return ONE task object with name, project, deadline, and chunks.`;
}

function buildUserPrompt(input, mode) {
  if (mode === 'coach') {
    return `Brain dump from user (extract ALL tasks):
"${input}"

Respond ONLY with JSON array:
[{"name":"task","project":"Project","deadline":"ISO-date","chunks":["step1","step2","step3"]}]`;
  }

  return `Parse this into a task:
"${input}"

Respond ONLY with JSON:
{"name":"Task name","project":"Project","deadline":"ISO-date","chunks":["step1","step2","step3"]}`;
}

// ============================================
// RESPONSE PARSING
// ============================================

function parseClaudeResponse(responseText, mode) {
  try {
    // Clean up response - remove markdown code blocks if present
    let cleaned = responseText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const parsed = JSON.parse(cleaned);

    if (mode === 'coach' && Array.isArray(parsed)) {
      // Multiple tasks from brain dump
      return {
        tasks: parsed.map(task => ({
          name: task.name || 'Untitled',
          project: task.project || 'Inbox',
          deadline: task.deadline || getDefaultDeadline(),
          chunks: formatChunks(task.chunks)
        })),
        mode: 'coach'
      };
    }

    // Single task
    return {
      name: parsed.name || 'Untitled',
      project: parsed.project || 'Inbox',
      deadline: parsed.deadline || getDefaultDeadline(),
      chunks: formatChunks(parsed.chunks),
      mode: 'parse'
    };

  } catch (error) {
    console.error('Parse error:', error, 'Response:', responseText);
    
    // Fallback: try to extract basic info
    return {
      name: extractFallbackName(responseText),
      project: 'Inbox',
      deadline: getDefaultDeadline(),
      chunks: [
        { name: 'Start task', completed: false },
        { name: 'Main work', completed: false },
        { name: 'Finish up', completed: false }
      ],
      mode: 'fallback'
    };
  }
}

function formatChunks(chunks) {
  if (!chunks || !Array.isArray(chunks)) {
    return [
      { name: 'Start task', completed: false },
      { name: 'Main work', completed: false },
      { name: 'Finish up', completed: false }
    ];
  }

  return chunks.map((chunk, i) => ({
    id: generateId(),
    name: typeof chunk === 'string' ? chunk : chunk.name || `Step ${i + 1}`,
    completed: false,
    order: i
  }));
}

function getDefaultDeadline() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0); // 6 PM tomorrow
  return tomorrow.toISOString();
}

function extractFallbackName(text) {
  // Try to extract something useful from malformed response
  const nameMatch = text.match(/"name"\s*:\s*"([^"]+)"/);
  if (nameMatch) return nameMatch[1];
  
  // Just use first 50 chars
  return text.substring(0, 50).replace(/[^\w\s]/g, ' ').trim() || 'Untitled Task';
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

// ============================================
// RATE LIMITING
// ============================================

function checkRateLimit(clientIP, maxRequests) {
  const key = `${clientIP}_${new Date().toDateString()}`;
  const current = rateLimitStore.get(key) || 0;
  return current < maxRequests;
}

function incrementRateLimit(clientIP) {
  const key = `${clientIP}_${new Date().toDateString()}`;
  const current = rateLimitStore.get(key) || 0;
  rateLimitStore.set(key, current + 1);
  
  // Clean up old entries (simple memory management)
  if (rateLimitStore.size > 10000) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const oldPrefix = yesterday.toDateString();
    
    for (const [k] of rateLimitStore) {
      if (k.includes(oldPrefix)) {
        rateLimitStore.delete(k);
      }
    }
  }
}
