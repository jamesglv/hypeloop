import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is not set')
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

    // Get auth token from request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify user
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get request body
    const { creator_id, price_per_month, currency = 'USD' } = await req.json()

    if (!creator_id || !price_per_month) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: creator_id, price_per_month' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get creator info
    const { data: creator, error: creatorError } = await supabaseClient
      .from('creators')
      .select('id, display_name, username')
      .eq('id', creator_id)
      .single()

    if (creatorError || !creator) {
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get or create fan info
    let { data: fan, error: fanError } = await supabaseClient
      .from('fans')
      .select('id, display_name, username')
      .eq('id', user.id)
      .maybeSingle()

    // If fan profile doesn't exist, create it
    if (fanError || !fan) {
      const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'
      let username = user.user_metadata?.username || `user_${user.id.substring(0, 8)}`
      
      // Try to create fan profile, handle username conflicts
      let newFan = null
      let createError = null
      let attempts = 0
      const maxAttempts = 3
      
      while (attempts < maxAttempts && !newFan) {
        const { data, error } = await supabaseClient
          .from('fans')
          .insert({
            id: user.id,
            display_name: displayName,
            username: username,
          })
          .select('id, display_name, username')
          .single()

        if (!error && data) {
          newFan = data
          break
        }
        
        // If username conflict, try with a suffix
        if (error?.code === '23505') { // Unique violation
          username = `${username}_${Math.random().toString(36).substring(2, 6)}`
          attempts++
        } else {
          createError = error
          break
        }
      }

      if (createError || !newFan) {
        console.error('Error creating fan profile:', createError)
        return new Response(
          JSON.stringify({ error: 'Failed to create fan profile' }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
      
      fan = newFan
    }

    // Check if active subscription already exists
    const { data: existingSubscription } = await supabaseClient
      .from('subscriptions')
      .select('id, stripe_subscription_id')
      .eq('fan_id', user.id)
      .eq('creator_id', creator_id)
      .eq('status', 'active')
      .maybeSingle()

    if (existingSubscription) {
      return new Response(
        JSON.stringify({ error: 'Active subscription already exists', subscription_id: existingSubscription.id }),
        { 
          status: 409,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get or create Stripe customer
    let stripeCustomerId: string | null = null
    
    // Check if fan has an existing stripe_customer_id from previous subscriptions
    const { data: existingSubscriptionWithCustomer } = await supabaseClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('fan_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .limit(1)
      .maybeSingle()

    if (existingSubscriptionWithCustomer?.stripe_customer_id) {
      stripeCustomerId = existingSubscriptionWithCustomer.stripe_customer_id
    } else {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email || undefined,
        name: fan.display_name || undefined,
        metadata: {
          fan_id: user.id,
          supabase_user_id: user.id,
        },
      })
      stripeCustomerId = customer.id
    }

    // Get base URL for redirects
    const baseUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.supabase.co') || ''
    const siteUrl = Deno.env.get('SITE_URL') || 'http://localhost:5173'
    
    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Subscribe to ${creator.display_name}'s Brain`,
              description: `Monthly subscription to chat with ${creator.display_name}'s AI`,
            },
            unit_amount: Math.round(price_per_month * 100), // Convert to cents
            recurring: {
              interval: 'month',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl}/dashboard/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/dashboard/subscription-cancel`,
      metadata: {
        fan_id: user.id,
        creator_id: creator_id,
        price_per_month: price_per_month.toString(),
        currency: currency,
      },
      subscription_data: {
        metadata: {
          fan_id: user.id,
          creator_id: creator_id,
          price_per_month: price_per_month.toString(),
          currency: currency,
        },
      },
    })

    return new Response(
      JSON.stringify({ 
        checkout_url: session.url,
        session_id: session.id 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

