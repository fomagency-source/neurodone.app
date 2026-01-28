// Vercel Serverless Function - Gemini AI Proxy
// FIXED VERSION for Neurodone.app

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'API key not configured' });

  // Using gemini-3-flash-preview (latest available)
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent';

  try {
    const { action, data } = req.body;
    
    let prompt = "";

    // =========================================
    // MODE 1: GENERATE CHUNKS (task → micro-steps)
    // =========================================
    if (action === 'generateChunks') {
      prompt = `You are an ADHD productivity coach. Break this task into 3-4 tiny, specific micro-steps.

RULES:
1. First step must take under 2 minutes
2. Use physical action verbs: Open, Click, Write, Pick up
3. Include actual task details in steps (not generic)
4. Last step should feel satisfying

Task: "${data.taskName}"

Respond with ONLY a JSON array of strings like this example:
["Step 1", "Step 2", "Step 3"]

JSON array:`;
    }

    // =========================================
    // MODE 2: PARSE VOICE (transcript → task list)
    // =========================================
    else if (action === 'parseVoice') {
      prompt = `You are a task extraction engine. Extract SEPARATE tasks from this voice input.

RULES:
1. Split on "and", "also", "then" - each becomes SEPARATE task
2. Remove filler words like "I need to", "um", "like"
3. Keep task names SHORT (2-6 words)
4. Extract deadlines: today, tomorrow, monday, saturday, etc.
5. If no deadline mentioned, use "today"

Voice input: "${data.transcript}"

Respond with ONLY a JSON array like this example:
[{"name": "Call Dave", "deadline": "tomorrow"}, {"name": "Buy milk", "deadline": "today"}]

JSON array:`;
    }

    // =========================================
    // MODE 3: AI COACH (brain dump → organized plan)
    // =========================================
    else if (action === 'coachSession') {
      prompt = `You are an empathetic ADHD coach. Help organize this brain dump.

Brain dump: "${data.transcript}"

Respond with ONLY valid JSON in this exact format:
{
  "encouragement": "One short encouraging sentence",
  "tasks": [
    {"name": "Task name", "deadline": "today", "chunks": ["Step 1", "Step 2", "Step 3"]}
  ]
}

JSON:`;
    } 
    else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // =========================================
    // CALL GEMINI API
    // =========================================
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1500
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return res.status(response.status).json({ error: 'AI service error', details: errorText });
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    console.log(`[${action}] Raw:`, rawText);

    if (!rawText) {
      return res.status(500).json({ error: 'Empty AI response' });
    }

    // Parse JSON from response
    let parsedData;
    try {
      // Find JSON in the response
      const jsonMatch = rawText.match(/[\[{][\s\S]*[\]}]/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (e) {
      console.error('Parse error:', e, 'Raw:', rawText);
      return res.status(500).json({ error: 'Failed to parse AI response', raw: rawText });
    }

    console.log(`[${action}] Parsed:`, parsedData);

    return res.status(200).json({
      success: true,
      data: parsedData
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
