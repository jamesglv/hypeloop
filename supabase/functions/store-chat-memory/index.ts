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

    const { subscription_id, fan_id, creator_id, limit = 50 } = await req.json()

    if (!subscription_id && !fan_id && !creator_id) {
      return new Response(
        JSON.stringify({ error: 'Must provide subscription_id or (fan_id and creator_id)' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Build query
    let query = supabaseClient
      .from('messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(limit)

    if (subscription_id) {
      query = query.eq('subscription_id', subscription_id)
    } else {
      if (fan_id) query = query.eq('fan_id', fan_id)
      if (creator_id) query = query.eq('creator_id', creator_id)
      if (fan_id && creator_id) {
        query = query.eq('fan_id', fan_id).eq('creator_id', creator_id)
      }
    }

    const { data: messages, error } = await query

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Format messages for conversation history
    const conversationHistory = messages?.map(msg => ({
      role: msg.role,
      content: msg.content,
      created_at: msg.created_at,
      id: msg.id
    })) || []

    return new Response(
      JSON.stringify({ 
        conversation_history: conversationHistory,
        count: conversationHistory.length
      }),
      { 
        status: 200,
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

