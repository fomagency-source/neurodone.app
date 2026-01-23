# NEURODONE - Secure Deployment Guide 🔒

## Quick Start

### 1. Deploy to Vercel

```bash
# Push to GitHub
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/neurodone.git
git push -u origin main
```

Then go to [vercel.com](https://vercel.com) → New Project → Import your repo

### 2. Set Environment Variables

**In Vercel Dashboard:**
1. Go to your project → Settings → Environment Variables
2. Add:
   - **Name:** `GEMINI_API_KEY`
   - **Value:** `your-gemini-api-key`
3. Click Save
4. Redeploy

### 3. Done! 🎉

Your API key is now secure on the server.

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Browser App   │────▶│  Vercel Function │────▶│  Gemini API │
│   (app.html)    │     │    (/api/ai)     │     │             │
└─────────────────┘     └──────────────────┘     └─────────────┘
        │                       │
        │   No API key          │  API key stored
        │   in browser!         │  securely here
        ▼                       ▼
    🔒 Secure              🔑 Secret
```

## Files

```
neurodone-secure/
├── api/
│   └── ai.js           # Serverless function (Gemini proxy)
├── app.html            # Main React app
├── landing.html        # Marketing page
├── manifest.json       # PWA manifest
├── sw.js               # Service worker
├── icon-192.svg        # App icons
├── icon-512.svg
├── vercel.json         # Routing config
├── .env.example        # Environment template
└── README.md           # This file
```

## API Endpoints

### POST /api/ai

**Actions:**

| Action | Description | Data |
|--------|-------------|------|
| `generateChunks` | Break task into micro-steps | `{ taskName: string }` |
| `parseVoice` | Parse voice input into tasks | `{ transcript: string }` |
| `coachSession` | Full AI coach brain dump | `{ transcript: string }` |

**Example:**
```javascript
const response = await fetch('/api/ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    action: 'generateChunks',
    data: { taskName: 'Write blog post about ADHD' }
  })
});

const result = await response.json();
// { success: true, data: ["Open doc...", "Outline...", ...] }
```

## Local Development

```bash
# Install Vercel CLI
npm i -g vercel

# Create .env.local
cp .env.example .env.local
# Edit .env.local and add your Gemini API key

# Run locally
vercel dev
```

## Future: Train Your Own Model

The app logs all AI interactions to localStorage. Export this data to train your own model:

```javascript
// In browser console
const logs = JSON.parse(localStorage.getItem('neurodone_ai_logs'));
console.log(JSON.stringify(logs, null, 2));
// Copy and save to training_data.json
```

Once you have 10k+ examples, fine-tune:
- **Gemma 2B** (Google, free)
- **Llama 3 8B** (Meta, free)
- **Mistral 7B** (free)

---

## Support

- 💬 Discord: discord.gg/neurodone
- ✉️ Email: fomagency@gmail.com

Built with 💜 for the ADHD community
