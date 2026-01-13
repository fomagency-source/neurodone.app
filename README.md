# NEURODONE 🧠

> Task management that works WITH your ADHD brain, not against it.

Built by someone with ADHD, for people with ADHD. Voice-to-task, AI chunking, dopamine-friendly design.

## Features

- 🎤 **Voice-to-Task** — Speak naturally, AI extracts task, project & deadline
- 🧩 **Auto-Chunking** — Big tasks auto-break into 5-15 minute pieces
- 📅 **Calendar View** — Week at a glance, tap to add tasks
- ✨ **Dopamine Design** — Celebrations, progress bars, satisfying animations
- 🔔 **ADHD Reminders** — Gentle nudges that actually work
- 💳 **Subscription Ready** — Stripe integration with trial support

## Quick Start

### 1. Clone & Deploy to Vercel

```bash
git clone https://github.com/yourusername/neurodone.git
cd neurodone
```

Push to GitHub, then import in [Vercel](https://vercel.com).

### 2. Set Environment Variables

In Vercel Dashboard → Project Settings → Environment Variables:

```env
# Claude API (for task parsing)
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Stripe (for payments)
STRIPE_SECRET_KEY=sk_live_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
STRIPE_PRICE_MONTHLY=price_xxxxx
STRIPE_PRICE_YEARLY=price_xxxxx

# App URL
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

### 3. Setup Stripe

1. Create account at [stripe.com](https://stripe.com)
2. Create Product: "NEURODONE Pro"
3. Add Prices:
   - Monthly: $5/month (recurring)
   - Yearly: $39/year (recurring)
4. Copy Price IDs to env vars
5. Set up webhook endpoint: `https://your-domain.com/api/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`

### 4. Connect Your Domain

In Vercel: Project Settings → Domains → Add your domain

## Project Structure

```
neurodone/
├── landing.html      # Marketing landing page
├── app.html          # Main PWA application
├── manifest.json     # PWA manifest
├── sw.js            # Service worker
├── icon-192.svg     # App icon
├── vercel.json      # Vercel routing config
├── api/
│   ├── parse-task.js      # Claude API for task parsing
│   ├── create-checkout.js # Stripe checkout session
│   ├── customer-portal.js # Stripe billing portal
│   └── webhook.js         # Stripe webhooks
└── .env.example     # Environment variables template
```

## URLs

| Path | Description |
|------|-------------|
| `/` | Landing page (marketing) |
| `/app` | Main application |
| `/terms` | Terms of Service |
| `/privacy` | Privacy Policy |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/parse-task` | POST | Parse text into structured task via Claude |
| `/api/create-checkout` | POST | Create Stripe checkout session |
| `/api/customer-portal` | POST | Create Stripe billing portal session |
| `/api/webhook` | POST | Stripe webhook handler |

## Development

For local development:

```bash
npm i -g vercel
vercel dev
```

## Cost Estimates

- **Claude API**: ~$0.001-0.003 per task parse (using Haiku)
- **1000 users × 10 tasks/day** ≈ $5-10/day
- **Rate limit**: 30 tasks/day per free user

## Legal Requirements (EU/Slovakia)

The app includes:
- Business ID display in Profile
- Terms of Service link
- Privacy Policy link
- Refund Policy link
- Payment method display for subscribers
- VAT ID collection at checkout

## Roadmap

- [x] Voice-to-task
- [x] AI task chunking
- [x] PWA support
- [x] Stripe subscription
- [ ] Google Calendar sync
- [ ] Push notifications
- [ ] Team/sharing features
- [ ] Widgets (iOS/Android)

## License

Proprietary — All rights reserved.

---

Made with 🧠 for ADHD brains everywhere.
