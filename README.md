# 🧠 NEURODONE

**The task manager built by someone with ADHD, for ADHD brains.**

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/fomagency-source/neurodone.app)

## Why I Built This

I was undiagnosed with ADHD until 2023 (age 32). After 13+ years in marketing and managing teams, I finally understood why every task manager failed me — they weren't built for brains like mine.

**NEURODONE is different:**
- 🎤 **Voice-first input** — Speak, don't type
- 🧩 **AI task chunking** — Big tasks → small, doable steps
- 🎯 **One thing at a time** — No overwhelming dashboards
- 🎉 **Dopamine rewards** — Celebrate every small win
- 👥 **Real community** — Chat directly with me

## Features

### Smart Parsing System
- **Self-learning local parser** — Gets smarter with your usage patterns
- **Claude AI backup** — Complex inputs only (saves costs)
- **60-70% local / 30-40% cloud** — Efficient and affordable

### ADHD-Friendly Design
- Maximum 3-5 tasks visible at once
- Progress bars on everything
- Micro-celebrations for completed chunks
- No shame for "overdue" tasks

### Community-Driven
- Direct feedback to me (Ihor)
- Discord & WhatsApp groups
- Shape the product roadmap
- Fair pricing: $5/month

## Tech Stack

- **Frontend:** React (via CDN), vanilla JS
- **Backend:** Vercel Edge Functions
- **AI:** Claude 3.5 Haiku (cost-optimized)
- **Payments:** Paddle
- **PWA:** Installable on any device

## Local Development

```bash
# Clone the repo
git clone https://github.com/fomagency-source/neurodone.app

# No build required - just serve static files
npx serve .

# Or use any static server
python -m http.server 8080
```

## Deployment

### Vercel (Recommended)
1. Fork this repo
2. Import to Vercel
3. Add environment variable:
   - `ANTHROPIC_API_KEY` — Your Claude API key from console.anthropic.com
4. Deploy!

### Environment Variables
| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Claude API key for AI features |

## Project Structure

```
neurodone.app/
├── app.html          # Main PWA application
├── landing.html      # Marketing landing page
├── neurodone-ai.js   # Self-learning AI parser
├── api/
│   └── parse.js      # Claude API serverless function
├── manifest.json     # PWA configuration
├── sw.js             # Service worker (offline support)
├── icon-192.svg      # App icon
├── icon-512.svg      # Large app icon
└── vercel.json       # Deployment config
```

## How the AI Works

```
User Input → Decision Engine
                ↓
    ┌─────────────────────────────┐
    │  Is it simple & familiar?   │
    └─────────────────────────────┘
           ↓ YES          ↓ NO
    ┌──────────┐    ┌──────────────┐
    │  LOCAL   │    │  CLAUDE API  │
    │  PARSER  │    │  (Haiku)     │
    └──────────┘    └──────────────┘
           ↓               ↓
           └───────┬───────┘
                   ↓
           Learn patterns for
           future local parsing
```

### Cost Optimization
- Local parser handles 60-70% of inputs (FREE)
- Claude API only for complex cases
- Self-learning system improves over time
- Rate limits protect against abuse

## Pricing Model

| Plan | Price | API Calls/Day |
|------|-------|---------------|
| Free Trial | $0 | 5 |
| Monthly | $5/mo | 50 |
| Yearly | $39/yr | 50 |

## Contributing

This is a personal project, but I welcome:
- Bug reports
- Feature suggestions
- Community feedback

Join our [Discord](https://discord.gg/YOUR_DISCORD) or [WhatsApp](https://chat.whatsapp.com/YOUR_WHATSAPP) to discuss!

## About Me

**Ihor Fomenko** — Head of Marketing with 13+ years in SaaS, Crypto, and Tech across EU. Built teams from scratch, managed campaigns at IMAX Ukraine, scaled products to thousands of users.

Diagnosed with ADHD in 2023. Building what I wish existed 10 years ago.

- 🌍 Based in Malta (originally from Ukraine)
- 💼 [LinkedIn](https://linkedin.com/in/ihorfomenko)
- 📧 fomagency@gmail.com

## License

MIT License — Feel free to learn from the code, but please don't just clone and compete 😅

---

**Made with 🧠 for ADHD brains**

*If this helps you, consider [buying me a coffee](https://ko-fi.com/ihorfomenko) or just star the repo!*
