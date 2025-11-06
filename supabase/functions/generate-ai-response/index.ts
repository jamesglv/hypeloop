import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Initialize Supabase client
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

    // Get request body
    const { fan_id, creator_id, message, subscription_id, conversation_history } = await req.json()

    if (!fan_id || !creator_id || !message) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: fan_id, creator_id, message' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify subscription exists and is active
    const { data: subscription, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('fan_id', fan_id)
      .eq('creator_id', creator_id)
      .eq('status', 'active')
      .single()

    if (subError || !subscription) {
      return new Response(
        JSON.stringify({ error: 'Active subscription required' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get creator profile and training data
    const { data: creator, error: creatorError } = await supabaseClient
      .from('creators')
      .select(`
        *,
        creator_profiles (*)
      `)
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

    // Get creator training data
    const { data: trainingData } = await supabaseClient
      .from('creator_training')
      .select('*')
      .eq('creator_id', creator_id)
      .eq('is_complete', true)
      .order('pillar', { ascending: true })
      .order('display_order', { ascending: true })

    // Build AI prompt from creator profile
    const profile = creator.creator_profiles?.[0] || {}
    const prompt = buildCreatorPrompt(creator, profile, trainingData || [], conversation_history || [])

    // Call OpenAI API (you'll need to set OPENAI_API_KEY in Supabase secrets)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4', // or 'gpt-3.5-turbo' for cost savings
        messages: [
          { role: 'system', content: prompt },
          ...(conversation_history || []).map((msg: any) => ({
            role: msg.role === 'fan' ? 'user' : 'assistant',
            content: msg.content
          })),
          { role: 'user', content: message }
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    })

    const openaiData = await openaiResponse.json()

    if (!openaiResponse.ok) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API error', details: openaiData }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const aiResponse = openaiData.choices[0]?.message?.content || ''

    // Check if approval is required
    const requiresApproval = profile.approve_messages_before_ai || false
    const messageStatus = requiresApproval ? 'pending_approval' : 'sent'

    // Store the fan message
    const { data: fanMessage, error: fanMsgError } = await supabaseClient
      .from('messages')
      .insert({
        subscription_id: subscription.id,
        fan_id,
        creator_id,
        content: message,
        role: 'fan',
        status: 'sent',
      })
      .select()
      .single()

    if (fanMsgError) {
      console.error('Error storing fan message:', fanMsgError)
    }

    // Store the AI response message
    const { data: aiMessage, error: aiMsgError } = await supabaseClient
      .from('messages')
      .insert({
        subscription_id: subscription.id,
        fan_id,
        creator_id,
        content: aiResponse,
        role: 'ai',
        is_ai_generated: true,
        ai_prompt_used: prompt.substring(0, 1000), // Store first 1000 chars of prompt
        ai_model_used: 'gpt-4',
        ai_tokens_used: openaiData.usage?.total_tokens,
        status: messageStatus,
        parent_message_id: fanMessage?.id,
        thread_id: fanMessage?.thread_id || fanMessage?.id,
      })
      .select()
      .single()

    if (aiMsgError) {
      console.error('Error storing AI message:', aiMsgError)
    }

    return new Response(
      JSON.stringify({ 
        response: aiResponse,
        message_id: aiMessage?.id,
        status: messageStatus,
        requires_approval: requiresApproval
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

function buildCreatorPrompt(creator: any, profile: any, trainingData: any[], history: any[]): string {
  let prompt = `You are ${creator.display_name}. ${creator.bio || ''}\n\n`

  // Add niche
  if (profile.niche && profile.niche.length > 0) {
    prompt += `Your niche: ${profile.niche.join(', ')}\n\n`
  }

  // Add tone settings
  if (profile.tone_settings) {
    const tone = profile.tone_settings
    prompt += `Tone: ${tone.formal_casual || 65}% casual. `
    prompt += `Energy: ${tone.calm_energetic || 85}% energetic. `
    prompt += `Communication style: ${tone.gentle_blunt || 70}% blunt.\n\n`
  }

  // Add response style
  if (profile.response_style) {
    prompt += `Response style: ${profile.response_style}\n\n`
  }

  // Add training data
  if (trainingData.length > 0) {
    prompt += `Training data:\n`
    const pillars = ['voice', 'humor', 'expertise', 'story', 'community']
    pillars.forEach(pillar => {
      const pillarData = trainingData.filter(t => t.pillar === pillar && t.answer)
      if (pillarData.length > 0) {
        prompt += `${pillar}:\n`
        pillarData.forEach(t => {
          prompt += `Q: ${t.question}\nA: ${t.answer}\n`
        })
      }
    })
    prompt += `\n`
  }

  // Add emoji bank
  if (profile.emoji_bank && profile.emoji_bank.length > 0) {
    prompt += `Emoji usage: ${profile.emoji_bank.map((e: any) => `${e.emoji} = ${e.meaning}`).join(', ')}\n\n`
  }

  // Add default greeting style
  if (profile.default_greeting) {
    prompt += `Default greeting style: "${profile.default_greeting}"\n\n`
  }

  prompt += `Respond naturally in ${creator.display_name}'s voice and style. Be authentic, engaging, and helpful.`

  return prompt
}

