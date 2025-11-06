# Stripe Webhook Troubleshooting Guide

## Problem: No logs appearing for stripe-webhook function

If you're not seeing any logs, it means Stripe isn't calling your webhook endpoint. Follow these steps to diagnose and fix:

## Step 1: Verify the Function is Deployed

1. **Check if the function exists:**
   ```bash
   supabase functions list
   ```
   
   You should see `stripe-webhook` in the list.

2. **Deploy the function if needed:**
   ```bash
   supabase functions deploy stripe-webhook
   ```

3. **IMPORTANT: Configure function for public access**
   
   Supabase Edge Functions require JWT verification by default, but Stripe webhooks don't send auth headers. You need to disable JWT verification for the webhook function:
   
   **Create/Update `supabase/config.toml`:**
   ```toml
   [functions.stripe-webhook]
   verify_jwt = false
   ```
   
   **Security Note:** This makes the function publicly accessible, but it's safe because:
   - The function verifies Stripe signatures for all requests
   - Only Stripe can successfully call the webhook (signature verification)
   - Invalid requests will be rejected by signature verification

4. **Test the endpoint directly:**
   Open in browser or use curl:
   ```bash
   curl https://uirdgypveetgohptzxiw.supabase.co/functions/v1/stripe-webhook
   ```
   
   You should get: `{"status":"ok","message":"Stripe webhook endpoint is active",...}`
   
   **If you get a 401 error**, the function hasn't been configured for public access. Make sure:
   1. `supabase/config.toml` exists with `[functions.stripe-webhook] verify_jwt = false`
   2. The function has been redeployed: `supabase functions deploy stripe-webhook`

## Step 2: Verify Stripe Webhook Configuration

1. **Go to Stripe Dashboard:**
   - Navigate to: https://dashboard.stripe.com/webhooks
   - Make sure you're in **Test mode** (toggle in top right)

2. **Check if webhook endpoint exists:**
   - Look for endpoint: `https://uirdgypveetgohptzxiw.supabase.co/functions/v1/stripe-webhook`
   - If it doesn't exist, create it (see Step 3)
   - If it exists, check its status:
     - ✅ **Enabled** = Good
     - ❌ **Disabled** = Click "Enable" or recreate it

3. **Verify events are selected:**
   Click on the webhook endpoint and ensure these events are enabled:
   - ✅ `checkout.session.completed`
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

4. **Check webhook delivery logs:**
   - Click on your webhook endpoint
   - Go to "Recent deliveries" tab
   - Look for recent events (especially `checkout.session.completed`)
   - Check the status:
     - ✅ **200** = Success (webhook was called)
     - ❌ **4xx/5xx** = Error (check the response body)
     - ⏱️ **Pending** = Stripe is retrying

## Step 3: Create/Update Webhook Endpoint in Stripe

If the webhook doesn't exist or needs to be recreated:

1. **In Stripe Dashboard:**
   - Go to: Developers → Webhooks
   - Click "Add endpoint"

2. **Enter endpoint URL:**
   ```
   https://uirdgypveetgohptzxiw.supabase.co/functions/v1/stripe-webhook
   ```

3. **Select events:**
   - Click "Select events"
   - Search and select:
     - `checkout.session.completed`
     - `customer.subscription.created`
     - `customer.subscription.updated`
     - `customer.subscription.deleted`
     - `invoice.payment_succeeded`
     - `invoice.payment_failed`
   - Click "Add events"

4. **Copy the signing secret:**
   - After creating, you'll see "Signing secret" (starts with `whsec_...`)
   - Copy this value

5. **Set the webhook secret in Supabase:**
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_secret_here
   ```
   
   Or in Supabase Dashboard:
   - Go to: Project Settings → Edge Functions → Secrets
   - Add/Update: `STRIPE_WEBHOOK_SECRET` = `whsec_...`

## Step 4: Test the Webhook

1. **Create a test subscription:**
   - Use test card: `4242 4242 4242 4242`
   - Complete checkout
   - Wait 10-30 seconds

2. **Check Stripe webhook logs:**
   - Go to Stripe Dashboard → Webhooks → Your endpoint → Recent deliveries
   - Look for `checkout.session.completed` event
   - Click on it to see:
     - Request details
     - Response status
     - Response body

3. **Check Supabase function logs:**
   - Go to Supabase Dashboard → Edge Functions → stripe-webhook → Logs
   - You should see logs like:
     ```
     [2024-01-01T12:00:00.000Z] Incoming request: POST /functions/v1/stripe-webhook
     Processing webhook event: checkout.session.completed
     ```

## Step 5: Common Issues

### Issue: "No stripe-signature header"
- **Cause**: Request isn't coming from Stripe
- **Fix**: Verify webhook URL in Stripe matches exactly

### Issue: "Webhook signature verification failed"
- **Cause**: `STRIPE_WEBHOOK_SECRET` doesn't match Stripe's signing secret
- **Fix**: 
  1. Get the signing secret from Stripe Dashboard → Webhooks → Your endpoint
  2. Update in Supabase: `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...`
  3. Redeploy function: `supabase functions deploy stripe-webhook`

### Issue: "Missing fan_id or creator_id in session metadata"
- **Cause**: Metadata not being set in checkout session
- **Fix**: Check `create-checkout-session` function is setting metadata correctly

### Issue: Webhook returns 500 error
- **Cause**: Function error (check Supabase logs)
- **Fix**: Check function logs for specific error message

### Issue: Webhook not being called at all
- **Causes**:
  1. Webhook endpoint not created in Stripe
  2. Webhook disabled in Stripe
  3. Wrong URL in Stripe
  4. Function not deployed
  5. **Function not configured for public access (401 errors)**
- **Fix**: Follow Steps 1-3 above, especially Step 1.3 for public access

### Issue: 401 "Missing authorization header" error
- **Cause**: Supabase Edge Function requires JWT verification by default, but Stripe webhooks don't send auth headers
- **Fix**: 
  1. Ensure `supabase/config.toml` exists with:
     ```toml
     [functions.stripe-webhook]
     verify_jwt = false
     ```
  2. Redeploy the function: `supabase functions deploy stripe-webhook`
  3. The function will be publicly accessible but still verify Stripe signatures for security

## Step 6: Manual Testing with Stripe CLI (Optional)

If you want to test locally:

1. **Install Stripe CLI:**
   ```bash
   brew install stripe/stripe-cli/stripe
   ```

2. **Login:**
   ```bash
   stripe login
   ```

3. **Forward webhooks:**
   ```bash
   stripe listen --forward-to https://uirdgypveetgohptzxiw.supabase.co/functions/v1/stripe-webhook
   ```

4. **Trigger test event:**
   ```bash
   stripe trigger checkout.session.completed
   ```

## Verification Checklist

- [ ] Function is deployed: `supabase functions list` shows `stripe-webhook`
- [ ] Health check works: `curl https://uirdgypveetgohptzxiw.supabase.co/functions/v1/stripe-webhook` returns OK
- [ ] Webhook endpoint exists in Stripe Dashboard
- [ ] Webhook is enabled (not disabled)
- [ ] Required events are selected (`checkout.session.completed`, etc.)
- [ ] `STRIPE_WEBHOOK_SECRET` is set in Supabase secrets
- [ ] Webhook URL matches exactly: `https://uirdgypveetgohptzxiw.supabase.co/functions/v1/stripe-webhook`
- [ ] Test subscription creates webhook event in Stripe Dashboard
- [ ] Function logs appear in Supabase Dashboard after webhook event

## Next Steps

Once webhooks are working:
1. Check Supabase logs for any errors during subscription creation
2. Verify subscriptions are being created in the database
3. Test the full flow: Subscribe → Webhook → Database → Chat access

