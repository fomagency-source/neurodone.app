// Vercel Serverless Function - Gemini AI Proxy
// This keeps your API key secure on the server

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  try {
    const { action, data } = req.body;

    let prompt = '';
    let maxTokens = 200;
    let temperature = 0.7;

    switch (action) {
      case 'generateChunks':
        prompt = `You are an ADHD-friendly task breakdown assistant. Break down this task into 2-4 simple, actionable micro-steps that feel easy to start. Each step should take 2-15 minutes max.

Task: "${data.taskName}"

Rules:
- First step should be the EASIEST possible start (2-min rule)
- Use simple, clear language
- Make steps feel achievable, not overwhelming
- Include a satisfying final step

Respond ONLY with a JSON array of step names, nothing else. Example:
["Open laptop and create new doc", "Write rough outline (5 min)", "Fill in details", "Quick review and done!"]`;
        break;

      case 'parseVoice':
        prompt = `You are an ADHD task assistant. Extract tasks from this voice input and clean them up.

Voice input: "${data.transcript}"

Rules:
- Extract individual tasks (there may be multiple)
- Clean up filler words (um, uh, like, so, etc.)
- Extract any mentioned deadlines (today, tomorrow, monday, etc.)
- Keep the essence of what the user wants to do

Respond ONLY with a JSON array of objects, nothing else. Example:
[{"name": "Buy groceries", "deadline": "today"}, {"name": "Call mom", "deadline": "tomorrow"}]

If no deadline mentioned, use "today".`;
        temperature = 0.3;
        maxTokens = 500;
        break;

      case 'coachSession':
        prompt = `You are an empathetic ADHD coach helping someone brain dump their thoughts into actionable tasks.

User's brain dump: "${data.transcript}"

Your job:
1. Extract ALL tasks mentioned (even vague ones)
2. For each task, create a clean title
3. Suggest a realistic deadline based on urgency clues
4. Generate 2-4 ADHD-friendly micro-steps for each task

Respond ONLY with JSON, nothing else:
{
  "encouragement": "brief encouraging message (1 sentence)",
  "tasks": [
    {
      "name": "Task title",
      "deadline": "today/tomorrow/in 3 days/next week",
      "chunks": ["Step 1", "Step 2", "Step 3"]
    }
  ]
}`;
        maxTokens = 1000;
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        }
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API error:', error);
      return res.status(response.status).json({ error: 'AI service error' });
    }

    const result = await response.json();
    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON from response
    let parsed = null;
    const jsonMatch = text.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch (e) {
        console.error('JSON parse error:', e);
      }
    }

    return res.status(200).json({
      success: true,
      data: parsed,
      raw: text
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
