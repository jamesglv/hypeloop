# Stripe Integration Setup Guide

This guide explains how to set up Stripe payment processing for fan subscriptions to creators.

## Overview

The Stripe integration includes:
1. **Checkout Session Creation** - Creates Stripe checkout sessions when fans subscribe
2. **Webhook Handler** - Processes Stripe events to sync subscription status
3. **Subscription Management** - Handles cancellations through Stripe API

## Prerequisites

1. A Stripe account (sign up at https://stripe.com)
2. Stripe API keys (Secret Key and Webhook Secret)

## Environment Variables

Add the following environment variables to your Supabase project:

### Required Variables

1. **STRIPE_SECRET_KEY**
   - Get from: Stripe Dashboard → Developers → API keys
   - Use test key for development: `sk_test_...`
   - Use live key for production: `sk_live_...`

2. **STRIPE_WEBHOOK_SECRET**
   - Get from: Stripe Dashboard → Developers → Webhooks
   - Create a webhook endpoint pointing to: `https://uirdgypveetgohptzxiw.supabase.co/functions/v1/stripe-webhook`
   - Copy the "Signing secret" (starts with `whsec_...`)

3. **SITE_URL**
   - Your frontend URL for redirects
   - Development: `http://localhost:5173`
   - Production: `https://yourdomain.com`

### Setting Environment Variables in Supabase

You have two options to set environment variables:

#### Option 1: Using Supabase Dashboard (Recommended)

1. **Go to your Supabase project dashboard**
   - Visit https://supabase.com/dashboard
   - Select your project

2. **Navigate to Edge Functions settings**
   - Click on **Project Settings** (gear icon in the left sidebar)
   - Click on **Edge Functions** in the settings menu
   - Scroll down to the **Secrets** section

3. **Add each environment variable**
   - Click **Add new secret**
   - Enter the variable name (e.g., `STRIPE_SECRET_KEY`)
   - Enter the variable value (your Stripe secret key starting with `sk_test_...` or `sk_live_...`)
   - Click **Save**
   - Repeat for each variable:
     - `STRIPE_SECRET_KEY` - Your Stripe secret key
     - `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook signing secret
     - `SITE_URL` - Your frontend URL (e.g., `http://localhost:5173`)

#### Option 2: Using Supabase CLI

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login and link your project**:
   ```bash
   supabase login
   supabase link --project-ref your-project-ref
   ```

3. **Set secrets**:
   ```bash
   # Set Stripe secret key
   supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
   
   # Set Stripe webhook secret
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
   
   # Set site URL
   supabase secrets set SITE_URL=http://localhost:5173
   ```

4. **Verify secrets are set**:
   ```bash
   supabase secrets list
   ```

#### Getting Your Stripe Secret Key

1. **Go to Stripe Dashboard**: https://dashboard.stripe.com
2. **Navigate to Developers → API keys**
3. **Copy your Secret key**:
   - For **testing**: Use the "Secret key" under "Test mode" (starts with `sk_test_...`)
   - For **production**: Toggle to "Live mode" and use the "Secret key" (starts with `sk_live_...`)
4. **Important**: Never share or commit this key to version control!

#### Security Notes

- ✅ **DO**: Store keys as environment variables in Supabase
- ✅ **DO**: Use test keys (`sk_test_...`) during development
- ✅ **DO**: Use live keys (`sk_live_...`) only in production
- ❌ **DON'T**: Hardcode keys in your code
- ❌ **DON'T**: Commit keys to Git
- ❌ **DON'T**: Share keys publicly or in screenshots

## Webhook Setup

### 1. Create Webhook Endpoint in Stripe

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click "Add endpoint"
3. **Enter endpoint URL:**
   ```
   https://uirdgypveetgohptzxiw.supabase.co/functions/v1/stripe-webhook
   ```
   
   **Note:** The webhook function is configured to be publicly accessible (JWT verification disabled) in `supabase/config.toml`. The function still verifies Stripe signatures for security.
   
4. **Select events to listen to** - Choose these specific events:
   - ✅ `checkout.session.completed` - Creates subscription when checkout completes
   - ✅ `customer.subscription.created` - Syncs subscription when created
   - ✅ `customer.subscription.updated` - Updates subscription status changes
   - ✅ `customer.subscription.deleted` - Marks subscription as canceled
   - ✅ `invoice.payment_succeeded` - Ensures subscription stays active after payment
   - ✅ `invoice.payment_failed` - Marks subscription as past_due when payment fails

   **Quick tip**: You can search for these events in the event selection dropdown, or select "Select events" and manually check each one.

5. Click "Add endpoint"
6. **Copy the "Signing secret"** (starts with `whsec_...`) - You'll need this for the `STRIPE_WEBHOOK_SECRET` environment variable

### 2. Test Webhook Locally (Optional)

Use Stripe CLI to test webhooks locally:
```bash
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

## Edge Functions

### Deploy Functions

Deploy the edge functions to Supabase:

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Deploy functions
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook
supabase functions deploy manage-subscription
```

## Testing

### Test Mode

1. Use Stripe test mode API keys
2. Use test card numbers from Stripe documentation:
   - Success: `4242 4242 4242 4242`
   - Decline: `4000 0000 0000 0002`
   - Any future expiry date and any 3-digit CVC

### Test Flow

1. Navigate to a creator profile as a fan
2. Click "Subscribe" or "Start Chat"
3. Complete checkout with test card
4. Verify subscription is created in database
5. Check Stripe Dashboard for payment record

## Database Schema

The `subscriptions` table includes:
- `stripe_subscription_id` - Stripe subscription ID
- `stripe_customer_id` - Stripe customer ID
- `status` - Subscription status (active, canceled, past_due, expired)
- `current_period_start` - Current billing period start
- `current_period_end` - Current billing period end
- `cancel_at_period_end` - Whether to cancel at period end

## Webhook Events Handled

- **checkout.session.completed** - Creates subscription when checkout completes
- **customer.subscription.created/updated** - Syncs subscription status
- **customer.subscription.deleted** - Marks subscription as canceled
- **invoice.payment_succeeded** - Ensures subscription is active
- **invoice.payment_failed** - Marks subscription as past_due

## Troubleshooting

### Checkout Not Redirecting

- Verify `SITE_URL` environment variable is set correctly
- Check browser console for errors
- Verify Supabase function is deployed and accessible

### Webhook Not Processing

- Verify webhook secret matches in Stripe Dashboard
- Check Supabase function logs for errors
- Ensure webhook endpoint URL is correct
- Verify events are selected in Stripe webhook settings

### Subscription Not Created

- Check webhook logs in Stripe Dashboard
- Verify database permissions allow webhook to insert/update
- Check Supabase function logs for errors
- Ensure metadata is passed correctly in checkout session

## Security Notes

1. Never expose Stripe secret keys in frontend code
2. Always verify webhook signatures
3. Use environment variables for all sensitive data
4. Enable Row Level Security (RLS) on subscriptions table
5. Validate user authentication before creating checkout sessions

## Production Checklist

- [ ] Switch to live Stripe API keys
- [ ] Update `SITE_URL` to production domain
- [ ] Configure production webhook endpoint
- [ ] Test end-to-end subscription flow
- [ ] Set up monitoring for webhook failures
- [ ] Configure email notifications for failed payments
- [ ] Review and test cancellation flow
- [ ] Set up Stripe Dashboard alerts

