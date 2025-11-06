import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

serve(async (req) => {
  // Log all incoming requests for debugging
  console.log(`[${new Date().toISOString()}] Incoming request: ${req.method} ${req.url}`)
  console.log('Request headers:', Object.fromEntries(req.headers.entries()))
  
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS preflight request')
    return new Response('ok', { headers: corsHeaders })
  }

  // Health check endpoint - allow GET requests without auth for testing
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({ 
        status: 'ok', 
        message: 'Stripe webhook endpoint is active',
        timestamp: new Date().toISOString(),
        note: 'This endpoint requires Stripe webhook signature verification for POST requests'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  // For POST requests, check if this is a Stripe webhook (has stripe-signature header)
  // If it doesn't have stripe-signature, it's not a valid webhook request
  const stripeSignature = req.headers.get('stripe-signature')
  if (!stripeSignature && req.method === 'POST') {
    console.error('POST request without stripe-signature header - not a valid Stripe webhook')
    return new Response(
      JSON.stringify({ 
        error: 'Missing stripe-signature header. This endpoint is for Stripe webhooks only.',
        hint: 'Stripe webhooks must include the stripe-signature header for security verification'
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
    
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    if (!stripeWebhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not set')
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2024-11-20.acacia',
      httpClient: Stripe.createFetchHttpClient(),
    })

    // Initialize Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Get the signature from the request headers
    const signature = req.headers.get('stripe-signature')
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'No stripe-signature header' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get the raw body
    const body = await req.text()

    // Verify webhook signature
    let event: Stripe.Event
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Log the event type for debugging
    console.log(`Processing webhook event: ${event.type}`)

    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log(`Checkout session completed: ${session.id}, mode: ${session.mode}`)
        
        // Only process subscription checkouts
        if (session.mode === 'subscription' && session.subscription) {
          console.log(`Processing subscription checkout: ${session.subscription}`)
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string,
            { expand: ['items.data.price.product'] }
          )

          const fanId = session.metadata?.fan_id
          const creatorId = session.metadata?.creator_id
          const pricePerMonth = parseFloat(session.metadata?.price_per_month || '0')
          const currency = session.metadata?.currency || 'USD'

          console.log('Session metadata:', {
            fan_id: fanId,
            creator_id: creatorId,
            price_per_month: session.metadata?.price_per_month,
            currency: currency,
          })

          if (!fanId || !creatorId) {
            console.error('Missing fan_id or creator_id in session metadata')
            console.error('Full session metadata:', session.metadata)
            break
          }

          // Create or update subscription in database
          const now = new Date()
          const periodEnd = new Date(subscription.current_period_end * 1000)

          // Check if subscription already exists
          const { data: existing } = await supabaseClient
            .from('subscriptions')
            .select('id')
            .eq('fan_id', fanId)
            .eq('creator_id', creatorId)
            .eq('status', 'active')
            .maybeSingle()

          if (existing) {
            // Update existing subscription
            const { error: updateError } = await supabaseClient
              .from('subscriptions')
              .update({
                stripe_subscription_id: subscription.id,
                stripe_customer_id: subscription.customer as string,
                status: subscription.status === 'active' ? 'active' : 'canceled',
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: periodEnd.toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end,
              })
              .eq('id', existing.id)
            
            if (updateError) {
              console.error('Error updating subscription:', updateError)
              throw updateError
            }
            console.log(`Updated subscription ${existing.id} for fan ${fanId} and creator ${creatorId}`)
          } else {
            // Ensure fan profile exists before creating subscription
            const { data: fan, error: fanError } = await supabaseClient
              .from('fans')
              .select('id')
              .eq('id', fanId)
              .maybeSingle()
            
            if (fanError) {
              console.error('Error checking fan:', fanError)
              throw fanError
            }
            
            if (!fan) {
              // Create fan profile if it doesn't exist
              const { error: createFanError } = await supabaseClient
                .from('fans')
                .insert({
                  id: fanId,
                  display_name: 'User',
                  username: `user_${fanId.substring(0, 8)}`,
                })
              
              if (createFanError) {
                console.error('Error creating fan profile:', createFanError)
                // Continue anyway - the subscription insert might still work
              }
            }
            
            // Create new subscription
            const { data: newSubscription, error: insertError } = await supabaseClient
              .from('subscriptions')
              .insert({
                fan_id: fanId,
                creator_id: creatorId,
                tier: 'basic',
                price_per_month: pricePerMonth,
                currency: currency,
                status: subscription.status === 'active' ? 'active' : 'canceled',
                stripe_subscription_id: subscription.id,
                stripe_customer_id: subscription.customer as string,
                current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
                current_period_end: periodEnd.toISOString(),
                cancel_at_period_end: subscription.cancel_at_period_end,
              })
              .select()
            
            if (insertError) {
              console.error('Error creating subscription:', insertError)
              console.error('Subscription data:', {
                fan_id: fanId,
                creator_id: creatorId,
                price_per_month: pricePerMonth,
                currency: currency,
                stripe_subscription_id: subscription.id,
              })
              throw insertError
            }
            console.log(`Created subscription ${newSubscription?.[0]?.id} for fan ${fanId} and creator ${creatorId}`)
          }
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        
        const fanId = subscription.metadata?.fan_id
        const creatorId = subscription.metadata?.creator_id

        if (!fanId || !creatorId) {
          console.error('Missing fan_id or creator_id in subscription metadata')
          break
        }

        const pricePerMonth = parseFloat(subscription.metadata?.price_per_month || '0')
        const currency = subscription.metadata?.currency || 'USD'

        // Update subscription in database
        const { data: existing } = await supabaseClient
          .from('subscriptions')
          .select('id')
          .eq('stripe_subscription_id', subscription.id)
          .maybeSingle()

        if (existing) {
          const { error: updateError } = await supabaseClient
            .from('subscriptions')
            .update({
              status: subscription.status === 'active' ? 'active' : 
                      subscription.status === 'canceled' ? 'canceled' :
                      subscription.status === 'past_due' ? 'past_due' : 'expired',
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
            })
            .eq('id', existing.id)
          
          if (updateError) {
            console.error('Error updating subscription:', updateError)
            throw updateError
          }
        } else {
          // Ensure fan profile exists
          const { data: fan } = await supabaseClient
            .from('fans')
            .select('id')
            .eq('id', fanId)
            .maybeSingle()
          
          if (!fan) {
            await supabaseClient
              .from('fans')
              .insert({
                id: fanId,
                display_name: 'User',
                username: `user_${fanId.substring(0, 8)}`,
              })
          }
          
          // Create if doesn't exist (shouldn't happen, but handle it)
          const { error: insertError } = await supabaseClient
            .from('subscriptions')
            .insert({
              fan_id: fanId,
              creator_id: creatorId,
              tier: 'basic',
              price_per_month: pricePerMonth,
              currency: currency,
              status: subscription.status === 'active' ? 'active' : 'canceled',
              stripe_subscription_id: subscription.id,
              stripe_customer_id: subscription.customer as string,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              cancel_at_period_end: subscription.cancel_at_period_end,
            })
          
          if (insertError) {
            console.error('Error creating subscription:', insertError)
            throw insertError
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        
        // Mark subscription as canceled
        const { error } = await supabaseClient
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('stripe_subscription_id', subscription.id)
        
        if (error) {
          console.error('Error updating deleted subscription:', error)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === 'string' 
            ? invoice.subscription 
            : invoice.subscription.id

          // Ensure subscription is active
          const { error } = await supabaseClient
            .from('subscriptions')
            .update({
              status: 'active',
            })
            .eq('stripe_subscription_id', subscriptionId)
          
          if (error) {
            console.error('Error updating subscription status on payment success:', error)
          }
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        
        if (invoice.subscription) {
          const subscriptionId = typeof invoice.subscription === 'string' 
            ? invoice.subscription 
            : invoice.subscription.id

          // Mark subscription as past_due
          const { error } = await supabaseClient
            .from('subscriptions')
            .update({
              status: 'past_due',
            })
            .eq('stripe_subscription_id', subscriptionId)
          
          if (error) {
            console.error('Error updating subscription status on payment failure:', error)
          }
        }
        break
      }

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

