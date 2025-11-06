import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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

    const { action, fan_id, creator_id, subscription_id, tier, price_per_month } = await req.json()

    if (action === 'create') {
      if (!fan_id || !creator_id || !tier || !price_per_month) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields for creation' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Check if active subscription already exists
      const { data: existing } = await supabaseClient
        .from('subscriptions')
        .select('*')
        .eq('fan_id', fan_id)
        .eq('creator_id', creator_id)
        .eq('status', 'active')
        .single()

      if (existing) {
        return new Response(
          JSON.stringify({ error: 'Active subscription already exists', subscription: existing }),
          { 
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // Create new subscription
      const now = new Date()
      const periodEnd = new Date(now)
      periodEnd.setMonth(periodEnd.getMonth() + 1)

      const { data: subscription, error } = await supabaseClient
        .from('subscriptions')
        .insert({
          fan_id,
          creator_id,
          tier,
          price_per_month,
          status: 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
        })
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({ subscription }),
        { 
          status: 201,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (action === 'cancel') {
      if (!subscription_id) {
        return new Response(
          JSON.stringify({ error: 'Missing subscription_id' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const { data: subscription, error } = await supabaseClient
        .from('subscriptions')
        .update({
          status: 'canceled',
          cancel_at_period_end: true,
        })
        .eq('id', subscription_id)
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({ subscription }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (action === 'update') {
      if (!subscription_id) {
        return new Response(
          JSON.stringify({ error: 'Missing subscription_id' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      const updateData: any = {}
      if (tier) updateData.tier = tier
      if (price_per_month) updateData.price_per_month = price_per_month

      const { data: subscription, error } = await supabaseClient
        .from('subscriptions')
        .update(updateData)
        .eq('id', subscription_id)
        .select()
        .single()

      if (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { 
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({ subscription }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use: create, cancel, or update' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

