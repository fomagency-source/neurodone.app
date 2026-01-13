// /api/create-checkout.js
// Creates Stripe Checkout session for subscription

import Stripe from 'stripe';

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
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
    const { userId, email, plan = 'monthly' } = await req.json();

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Price IDs from your Stripe Dashboard
    const priceIds = {
      monthly: process.env.STRIPE_PRICE_MONTHLY, // $5/month
      yearly: process.env.STRIPE_PRICE_YEARLY,   // $39/year (35% off)
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: email,
      client_reference_id: userId,
      line_items: [
        {
          price: priceIds[plan],
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/?canceled=true`,
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          userId: userId,
        },
      },
      metadata: {
        userId: userId,
      },
      // Required for EU/Slovakia compliance
      billing_address_collection: 'required',
      tax_id_collection: {
        enabled: true,
      },
      consent_collection: {
        terms_of_service: 'required',
      },
      custom_text: {
        terms_of_service_acceptance: {
          message: 'I agree to the [Terms of Service](https://neurodone.app/terms) and [Privacy Policy](https://neurodone.app/privacy)',
        },
      },
    });

    return new Response(JSON.stringify({ 
      sessionId: session.id,
      url: session.url,
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Stripe checkout error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
