// Vercel Serverless Function - Gemini AI Proxy
// Optimized for Neurodone.app (ADHD Focus)

export default async function handler(req, res) {
  // 1. CORS & Method Handling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Server Config Error: API Key missing' });

  // 2. We use Gemini 1.5 Flash for speed/cost. 
  // IMPORTANT: We will force JSON mode in the API call later.
  const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

  try {
    const { action, data } = req.body;
    
    // Default safe values
    let systemInstruction = "";
    let userPrompt = "";
    let jsonSchema = {}; 

    // ---------------------------------------------------------
    // MODE 1: AI CHUNKS (Split one task into micro-steps)
    // ---------------------------------------------------------
    if (action === 'generateChunks') {
      systemInstruction = `You are an expert ADHD productivity coach. 
      Your goal is to break a intimidating task into 3-5 ridiculously easy, specific micro-steps.
      
      RULES:
      1. First step must be "stupidly easy" (takes 30 seconds).
      2. No generic language like "Prepare" or "Execute". Use physical verbs: "Open", "Type", "Click".
      3. Total steps: Minimum 3, Maximum 5.
      
      OUTPUT SCHEMA: An array of strings.`;

      userPrompt = `Break down this task: "${data.taskName}"`;
    } 

    // ---------------------------------------------------------
    // MODE 2: SMART PARSING (Voice to List)
    // ---------------------------------------------------------
    else if (action === 'parseVoice') {
      systemInstruction = `You are a precise task extraction engine. 
      The user will speak a stream of consciousness about what they need to do.
      
      YOUR JOB:
      1. Identify distinct tasks.
      2. IGNORE conversational filler like "I need to do 3 things" or "Um, yeah".
      3. Extract specific deadlines if mentioned (convert words like "tomorrow" to dates relative to today, or keep as "tomorrow"). Default to "today" if urgent, or "no deadline" if vague.
      4. If the user says "Call Mom and Buy Milk", that is TWO tasks.

      OUTPUT SCHEMA: An array of objects: [{"name": "Task Name", "deadline": "string"}]`;

      userPrompt = `Extract tasks from this voice note: "${data.transcript}"`;
    }

    // ---------------------------------------------------------
    // MODE 3: AI COACH (Brain Dump -> Plan)
    // ---------------------------------------------------------
    else if (action === 'coachSession') {
      systemInstruction = `You are an empathetic ADHD Coach. The user is overwhelmed.
      
      YOUR JOB:
      1. Analyze their "brain dump".
      2. Write a short, encouraging 1-sentence validation (e.g., "I got you, let's crush this.").
      3. Extract the tasks into a structured list.
      4. For each task, automatically generate 3 micro-steps (chunks).
      5. Infer priority/deadline from tone.

      OUTPUT SCHEMA: 
      {
        "encouragement": "String",
        "tasks": [
          { "name": "String", "deadline": "String", "chunks": ["String", "String"] }
        ]
      }`;

      userPrompt = `Help me organize this brain dump: "${data.transcript}"`;
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    // 3. THE CALL TO GEMINI
    // We strictly enforce JSON output using 'responseMimeType'.
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: systemInstruction }, // Give the persona/rules first
              { text: userPrompt }         // Then the actual input
            ]
          }
        ],
        generationConfig: {
          temperature: 0.3,       // Low temp = less hallucination, more rule-following
          maxOutputTokens: 1000,
          responseMimeType: "application/json" // CRITICAL: This forces valid JSON
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API Error:', errorText);
      return res.status(response.status).json({ error: 'AI Service Error' });
    }

    const result = await response.json();
    const rawText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      return res.status(500).json({ error: 'Empty response from AI' });
    }

    // 4. PARSING (Much safer now thanks to responseMimeType)
    let parsedData;
    try {
      parsedData = JSON.parse(rawText);
    } catch (e) {
      console.error('JSON Parse Error:', e, 'Raw:', rawText);
      // Fallback: Try to clean common markdown if strict mode slipped (rare)
      const cleanText = rawText.replace(/```json/g, '').replace(/```/g, '');
      try {
        parsedData = JSON.parse(cleanText);
      } catch (e2) {
        return res.status(500).json({ error: 'Failed to parse AI response' });
      }
    }

    // Success response
    return res.status(200).json({
      success: true,
      data: parsedData
    });

  } catch (error) {
    console.error('Server Internal Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
