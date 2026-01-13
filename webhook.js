// /api/webhook.js
// Stripe webhook handler for subscription lifecycle events

import Stripe from 'stripe';

export const config = {
  api: {
    bodyParser: false,
  },
};

async function buffer(readable) {
  const chunks = [];
  for await (const chunk of readable) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end('Method not allowed');
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const signature = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      buf,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      console.log(`✅ Checkout completed for user ${session.client_reference_id}`);
      // TODO: Update user's subscription status in your database
      break;
    }

    case 'customer.subscription.created': {
      const subscription = event.data.object;
      console.log(`📝 Subscription created: ${subscription.id}`);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object;
      console.log(`🔄 Subscription ${subscription.id} updated to ${subscription.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object;
      console.log(`❌ Subscription canceled: ${subscription.id}`);
      // TODO: Revoke user's pro access
      break;
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object;
      console.log(`💰 Payment received: ${invoice.amount_paid / 100} ${invoice.currency.toUpperCase()}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object;
      console.log(`⚠️ Payment failed for invoice ${invoice.id}`);
      // TODO: Notify user about failed payment
      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return res.status(200).json({ received: true });
}
