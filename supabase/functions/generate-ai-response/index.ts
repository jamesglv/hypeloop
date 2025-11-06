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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase configuration')
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
    })

    // Get request body
    let body
    try {
      body = await req.json()
    } catch (e) {
      console.error('Error parsing request body:', e)
      return new Response(
        JSON.stringify({ error: 'Invalid request body' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }
    
    const { fan_id, creator_id, message_content, message, subscription_id, conversation_history, skip_save } = body
    
    // Support both 'message' and 'message_content' for backward compatibility
    const messageContent = message_content || message

    if (!fan_id || !creator_id || !messageContent) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: fan_id, creator_id, message' }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Verify subscription exists and is active (only if we're saving messages)
    let subscription = null
    if (!skip_save) {
      const { data: subData, error: subError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('fan_id', fan_id)
      .eq('creator_id', creator_id)
      .eq('status', 'active')
        .maybeSingle()

      if (subError || !subData) {
      return new Response(
        JSON.stringify({ error: 'Active subscription required' }),
        { 
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
      }
      subscription = subData
    } else {
      // If skip_save is true, try to get subscription but don't fail if it doesn't exist
      const { data: subData } = await supabaseClient
        .from('subscriptions')
        .select('id')
        .eq('fan_id', fan_id)
        .eq('creator_id', creator_id)
        .eq('status', 'active')
        .maybeSingle()
      subscription = subData || { id: subscription_id || null }
    }

    // Get creator data first
    const { data: creator, error: creatorError } = await supabaseClient
      .from('creators')
      .select('*')
      .eq('id', creator_id)
      .single()

    if (creatorError) {
      console.error('Error fetching creator:', creatorError)
      return new Response(
        JSON.stringify({ error: 'Creator not found', details: creatorError.message }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!creator) {
      console.error('Creator not found:', creator_id)
      return new Response(
        JSON.stringify({ error: 'Creator not found' }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Get creator profile with training data separately
    console.log('Fetching creator profile for creator_id:', creator_id)
    const { data: profileData, error: profileError } = await supabaseClient
      .from('creator_profiles')
      .select(`
        id,
        niche,
        tone_settings,
        response_style,
        voice_personality,
        humor_human_touch,
        expertise_knowledge,
        story_credibility,
        community_culture,
        emoji_bank,
        default_greeting
      `)
      .eq('id', creator_id)
      .maybeSingle()

    console.log('Profile query result:', {
      hasData: !!profileData,
      dataType: typeof profileData,
      error: profileError ? {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
        hint: profileError.hint
      } : null
    })

    if (profileError) {
      console.error('Error fetching creator profile:', JSON.stringify(profileError, null, 2))
      // Continue with empty profile - don't fail the request
    }

    if (!profileData) {
      console.warn(`⚠️ WARNING: No creator_profile found for creator_id: ${creator_id}`)
      console.warn('This creator may not have completed their profile setup yet.')
      console.warn('They need to save training data in the "Train Your Brain" page first.')
      
      // Return a helpful error message
      return new Response(
        JSON.stringify({ 
          error: 'Creator profile not found',
          details: 'This creator has not set up their profile yet. Please complete the "Train Your Brain" section first to save your personality, tone, and training data.',
          suggestion: 'Go to Settings → Train Your Brain and save your training data'
        }),
        { 
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const profile = profileData
    
    // Log profile data for debugging - VERY DETAILED
    console.log('Profile fetch result:', {
      hasProfileData: !!profileData,
      profileError: profileError?.message,
      profileKeys: profileData ? Object.keys(profileData) : [],
      profileId: profile?.id,
      hasNiche: !!profile?.niche,
      hasToneSettings: !!profile?.tone_settings,
      hasVoicePersonality: !!profile?.voice_personality,
      voicePersonalityType: typeof profile?.voice_personality,
      voicePersonalityIsArray: Array.isArray(profile?.voice_personality),
      voicePersonalityLength: Array.isArray(profile?.voice_personality) ? profile.voice_personality.length : 'N/A'
    })
    
    // Log raw profile data (first 2000 chars to avoid huge logs)
    if (profileData) {
      const profileStr = JSON.stringify(profileData, null, 2)
      console.log('Raw profile data (first 2000 chars):', profileStr.substring(0, 2000))
    }
    console.log('=== CREATOR PROFILE DEBUG ===')
    console.log('Creator profile found:', !!profile)
    console.log('Profile ID:', profile?.id)
    console.log('Full profile keys:', profile ? Object.keys(profile) : [])
    
    // Check each training data column in detail
    const trainingColumns = [
      'voice_personality',
      'humor_human_touch', 
      'expertise_knowledge',
      'story_credibility',
      'community_culture'
    ]
    
    if (profile) {
      trainingColumns.forEach(col => {
        const data = profile[col]
        console.log(`\n${col}:`)
        console.log('  - Type:', typeof data)
        console.log('  - Is Array:', Array.isArray(data))
        if (Array.isArray(data)) {
          console.log('  - Length:', data.length)
          if (data.length > 0) {
            console.log('  - First item:', JSON.stringify(data[0], null, 2))
            const validItems = data.filter((item: any) => item?.answer?.trim())
            console.log('  - Valid items (with answers):', validItems.length)
          }
        } else if (data) {
          console.log('  - Value:', JSON.stringify(data, null, 2))
        } else {
          console.log('  - Value: null/undefined')
        }
      })
      
      console.log('\nTone settings:', JSON.stringify(profile.tone_settings, null, 2))
      console.log('Response style:', profile.response_style)
      console.log('Emoji bank:', JSON.stringify(profile.emoji_bank, null, 2))
    }
    console.log('=== END PROFILE DEBUG ===\n')

    // Build AI prompt from creator profile
    // The training data is stored in creator_profiles as JSONB columns
    let prompt
    let promptSummary
    try {
      const result = buildCreatorPrompt(creator, profile, conversation_history || [])
      prompt = result.prompt
      promptSummary = result.summary
      
      console.log('\n=== PROMPT SUMMARY: TONE, PERSONALITY & STYLE ===')
      console.log('Creator:', creator.display_name)
      console.log('Niche/Expertise:', profile.niche?.join(', ') || 'Not specified')
      console.log('---')
      console.log('Tone Settings:')
      if (profile.tone_settings) {
        const tone = profile.tone_settings
        const formality = tone.formal_casual || 65
        const energy = tone.calm_energetic || 85
        const directness = tone.gentle_blunt || 70
        
        const formalityDesc = formality < 30 ? 'very formal' : formality > 70 ? 'very casual' : 'moderate'
        const energyDesc = energy < 30 ? 'calm/measured' : energy > 70 ? 'very energetic' : 'moderate'
        const directnessDesc = directness < 30 ? 'gentle/tactful' : directness > 70 ? 'very direct' : 'moderate'
        
        console.log(`  • Formality: ${formality}% casual (${formalityDesc})`)
        console.log(`  • Energy: ${energy}% energetic (${energyDesc})`)
        console.log(`  • Directness: ${directness}% blunt (${directnessDesc})`)
      } else {
        console.log('  • Not configured (using defaults)')
      }
      console.log('---')
      console.log('Response Style:', profile.response_style || 'Not specified')
      if (profile.response_style) {
        const styleDescriptions: Record<string, string> = {
          'comforting': 'Warm, empathetic, and supportive',
          'honest & direct': 'Straightforward and honest, no sugarcoating',
          'honest and direct': 'Straightforward and honest, no sugarcoating',
          'humorous': 'Funny, lighthearted, uses humor naturally',
          'private boundary': 'Respects privacy, maintains appropriate distance'
        }
        console.log(`  → ${styleDescriptions[profile.response_style.toLowerCase()] || 'Custom style'}`)
      }
      console.log('---')
      console.log('Training Data:')
      console.log(`  • Total examples: ${promptSummary.totalTrainingItems}`)
      console.log(`  • Voice & Personality: ${promptSummary.pillarCounts.voice_personality} examples`)
      console.log(`  • Humor & Human Touch: ${promptSummary.pillarCounts.humor_human_touch} examples`)
      console.log(`  • Expertise & Knowledge: ${promptSummary.pillarCounts.expertise_knowledge} examples`)
      console.log(`  • Story & Credibility: ${promptSummary.pillarCounts.story_credibility} examples`)
      console.log(`  • Community & Culture: ${promptSummary.pillarCounts.community_culture} examples`)
      console.log(`  • Has training data: ${promptSummary.hasTrainingData ? 'Yes ✓' : 'No ⚠️'}`)
      console.log('---')
      console.log('Emoji Usage:')
      if (profile.emoji_bank && Array.isArray(profile.emoji_bank) && profile.emoji_bank.length > 0) {
        const validEmojis = profile.emoji_bank.filter((e: any) => e && e.emoji && e.meaning)
        console.log(`  • ${validEmojis.length} emoji(s) configured`)
        validEmojis.slice(0, 5).forEach((e: any) => {
          console.log(`    ${e.emoji} = ${e.meaning}`)
        })
        if (validEmojis.length > 5) {
          console.log(`    ... and ${validEmojis.length - 5} more`)
        }
      } else {
        console.log('  • Not configured')
      }
      console.log('---')
      if (profile.default_greeting) {
        console.log('Default Greeting Style:', profile.default_greeting)
      }
      console.log('---')
      console.log('Prompt Stats:')
      console.log(`  • Total length: ${prompt.length} characters`)
      console.log(`  • Conversation history: ${conversation_history?.length || 0} messages`)
      console.log('=== END PROMPT SUMMARY ===\n')
      
      console.log('\n=== FINAL PROMPT INFO ===')
      console.log('Prompt length:', prompt.length)
      console.log('Prompt preview (first 1000 chars):')
      console.log(prompt.substring(0, 1000))
      console.log('\nPrompt preview (last 500 chars):')
      console.log(prompt.substring(Math.max(0, prompt.length - 500)))
      console.log('=== END PROMPT INFO ===\n')
    } catch (promptError) {
      console.error('Error building prompt:', promptError)
      return new Response(
        JSON.stringify({ error: 'Error building AI prompt', details: promptError.message }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Call OpenAI API (you'll need to set OPENAI_API_KEY in Supabase secrets)
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY')
    if (!openaiApiKey) {
      console.error('OpenAI API key not configured')
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured', details: 'Please set OPENAI_API_KEY in Supabase secrets' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Prepare messages for OpenAI
    // Add instruction to user message to reinforce training data usage
    let userMessage = messageContent
    if (promptSummary && promptSummary.hasTrainingData && promptSummary.totalTrainingItems > 0) {
      userMessage = `IMPORTANT: Before responding, review the ${promptSummary.totalTrainingItems} training examples in the system prompt. Match the exact style, vocabulary, and tone from those examples. Use the same sentence structures and phrases. DO NOT use generic AI language.\n\nFan's message: ${messageContent}`
    }
    
    const openaiMessages = [
      { role: 'system', content: prompt },
      ...(conversation_history || []).map((msg: any) => ({
        role: msg.role === 'fan' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ]

    console.log('Calling OpenAI API with model: gpt-3.5-turbo')
    console.log('Message count:', openaiMessages.length)
    console.log('Prompt length:', prompt.length)

    let openaiResponse
    try {
      openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
          model: 'gpt-3.5-turbo', // Using gpt-3.5-turbo as it's widely available and cost-effective
          messages: openaiMessages,
          temperature: 0.6, // Lower temperature for more deterministic, training-data-focused responses
          max_tokens: 500,
          presence_penalty: 0.3, // Higher penalty to encourage using words/phrases from training data
          frequency_penalty: 0.2, // Moderate penalty to avoid repetition while allowing training data patterns
      }),
    })
    } catch (fetchError) {
      console.error('Error fetching from OpenAI:', fetchError)
      return new Response(
        JSON.stringify({ 
          error: 'Failed to connect to OpenAI API', 
          details: fetchError.message 
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const responseText = await openaiResponse.text()
    let openaiData
    try {
      openaiData = JSON.parse(responseText)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', responseText)
      return new Response(
        JSON.stringify({ error: 'Failed to parse OpenAI response', details: responseText.substring(0, 500) }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!openaiResponse.ok) {
      console.error('OpenAI API error response:', openaiData)
      const errorMessage = openaiData.error?.message || openaiData.error?.code || 'Unknown OpenAI error'
      const errorType = openaiData.error?.type || 'Unknown'
      const errorCode = openaiData.error?.code || openaiResponse.status
      
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API error', 
          details: `${errorMessage} (Type: ${errorType}, Code: ${errorCode})`,
          fullError: openaiData.error
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const aiResponse = openaiData.choices[0]?.message?.content || ''

    // Only save messages if skip_save is not true
    let fanMessage = null
    let aiMessage = null
    let messageStatus = 'sent'
    let requiresApproval = false
    
    if (!skip_save && subscription?.id) {
    // Check if approval is required
      requiresApproval = profile.approve_messages_before_ai || false
      messageStatus = requiresApproval ? 'pending_approval' : 'sent'

    // Check if fan message already exists (prevent duplicates from multiple calls)
      const { data: existingFanMsg } = await supabaseClient
        .from('messages')
        .select('id, created_at')
        .eq('fan_id', fan_id)
        .eq('creator_id', creator_id)
        .eq('content', messageContent)
        .eq('role', 'fan')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      // Only insert if message doesn't exist or was created more than 5 seconds ago
      if (!existingFanMsg || (existingFanMsg.created_at && new Date(existingFanMsg.created_at).getTime() < Date.now() - 5000)) {
        // Store the fan message
        const { data: fanMsgData, error: fanMsgError } = await supabaseClient
          .from('messages')
          .insert({
            subscription_id: subscription.id,
            fan_id,
            creator_id,
            content: messageContent,
            role: 'fan',
            status: 'sent',
          })
          .select()
          .single()

        if (fanMsgError) {
          console.error('Error storing fan message:', fanMsgError)
        } else {
          fanMessage = fanMsgData
        }
      } else {
        // Use existing message
        fanMessage = existingFanMsg
        console.log('Using existing fan message to prevent duplicate')
      }

      // Store the AI response message
      const { data: aiMsgData, error: aiMsgError } = await supabaseClient
        .from('messages')
        .insert({
          subscription_id: subscription.id,
          fan_id,
          creator_id,
          content: aiResponse,
          role: 'ai',
          is_ai_generated: true,
          ai_prompt_used: prompt.substring(0, 1000), // Store first 1000 chars of prompt
          ai_model_used: 'gpt-3.5-turbo',
          ai_tokens_used: openaiData.usage?.total_tokens,
          status: messageStatus,
          parent_message_id: fanMessage?.id,
          thread_id: fanMessage?.thread_id || fanMessage?.id,
        })
        .select()
        .single()

      if (aiMsgError) {
        console.error('Error storing AI message:', aiMsgError)
      } else {
        aiMessage = aiMsgData
      }
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
    console.error('Unhandled error in edge function:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.stack || String(error)
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function buildCreatorPrompt(creator: any, profile: any, history: any[]): { prompt: string; summary: any } {
  // CRITICAL: Training data must come FIRST - this is the most important part
  // We'll build the prompt structure to prioritize training examples above all else

  // CRITICAL: Add training data FIRST and make it the primary focus
  // These are the 5 pillars of training data that define the creator's voice
  const pillars = [
    { key: 'voice_personality', name: 'Voice & Personality' },
    { key: 'humor_human_touch', name: 'Humor & Human Touch' },
    { key: 'expertise_knowledge', name: 'Expertise & Knowledge' },
    { key: 'story_credibility', name: 'Story & Credibility' },
    { key: 'community_culture', name: 'Community & Culture' }
  ]

  let hasTrainingData = false
  let totalTrainingItems = 0
  let trainingExamples: string[] = []
  const pillarCounts: Record<string, number> = {
    voice_personality: 0,
    humor_human_touch: 0,
    expertise_knowledge: 0,
    story_credibility: 0,
    community_culture: 0
  }
  
  // Collect all training data first
  console.log('=== PROCESSING TRAINING DATA ===')
  pillars.forEach(pillar => {
    const pillarData = profile[pillar.key]
    console.log(`\nProcessing ${pillar.key} (${pillar.name}):`)
    console.log('  - Raw data type:', typeof pillarData)
    console.log('  - Is array:', Array.isArray(pillarData))
    console.log('  - Is null/undefined:', pillarData === null || pillarData === undefined)
    
    // Handle different data structures
    let processedData: any[] = []
    
    if (pillarData) {
      if (Array.isArray(pillarData)) {
        processedData = pillarData
        console.log('  - Array length:', processedData.length)
      } else if (typeof pillarData === 'string') {
        // Try to parse if it's a JSON string
        try {
          const parsed = JSON.parse(pillarData)
          if (Array.isArray(parsed)) {
            processedData = parsed
            console.log('  - Parsed from JSON string, length:', processedData.length)
          }
        } catch (e) {
          console.log('  - Could not parse as JSON string')
        }
      } else if (typeof pillarData === 'object') {
        // If it's an object but not an array, try to convert
        console.log('  - WARNING: Data is object but not array, attempting to handle')
        processedData = [pillarData]
      }
    }
    
    if (processedData.length > 0) {
      console.log('  - First item sample:', JSON.stringify(processedData[0], null, 2))
      
      const validData = processedData.filter((item: any) => {
        // Handle different possible structures
        let answer: string | null = null
        let question: string | null = null
        
        if (item && typeof item === 'object') {
          answer = item.answer || item.Answer || item.response || item.Response || null
          question = item.question || item.Question || item.prompt || item.Prompt || null
        }
        
        const isValid = answer !== null && 
               typeof answer === 'string' && 
               answer.trim().length > 0
        
        if (!isValid && item) {
          console.log(`  - Invalid item structure:`, JSON.stringify(item, null, 2))
        }
        
        return isValid
      })
      
      console.log('  - Valid items (with answers):', validData.length)
      
      if (validData.length > 0) {
        hasTrainingData = true
        validData.forEach((item: any) => {
          // Handle different field names
          const question = item.question || item.Question || item.prompt || item.Prompt || 'Question'
          const answer = item.answer || item.Answer || item.response || item.Response
          
          if (question && answer) {
            const example = `[${pillar.name}] Q: ${question}\nA: ${answer}`
            trainingExamples.push(example)
            totalTrainingItems++
            pillarCounts[pillar.key]++
            console.log(`  - ✓ Added example: ${question.substring(0, 50)}...`)
          }
        })
      }
    } else {
      console.log('  - No valid data found (empty array or null/undefined)')
    }
  })
  
  console.log(`\nTotal training examples collected: ${totalTrainingItems}`)
  console.log('Has training data:', hasTrainingData)
  console.log('=== END PROCESSING TRAINING DATA ===\n')

  // Build prompt starting with training data - THIS IS THE MOST CRITICAL PART
  let prompt = ''
  
  if (hasTrainingData && trainingExamples.length > 0) {
    // START WITH TRAINING DATA - Most important, must come first
    prompt += `╔══════════════════════════════════════════════════════════════════════════════╗\n`
    prompt += `║                    YOU ARE ${creator.display_name.toUpperCase()}                      ║\n`
    prompt += `║  These ${totalTrainingItems} examples below are YOUR ACTUAL WORDS and RESPONSES      ║\n`
    prompt += `║  You MUST respond EXACTLY like these examples - copy the style, tone, and voice ║\n`
    prompt += `╚══════════════════════════════════════════════════════════════════════════════╝\n\n`
    
    prompt += `CRITICAL INSTRUCTION: The following ${totalTrainingItems} examples are REAL responses from ${creator.display_name}. `
    prompt += `These are NOT suggestions - these are EXAMPLES OF HOW YOU ACTUALLY SPEAK. `
    prompt += `When responding to fans, you MUST match the exact style, vocabulary, sentence structure, tone, and personality shown in these examples.\n\n`
    
    prompt += `STEP 1: Before writing ANY response, review ALL ${totalTrainingItems} examples below.\n`
    prompt += `STEP 2: Identify which example(s) are most similar to the fan's question or situation.\n`
    prompt += `STEP 3: Use the SAME words, phrases, sentence patterns, and tone from those examples.\n`
    prompt += `STEP 4: Write your response using the EXACT communication style from the examples.\n\n`
    
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    prompt += `YOUR ACTUAL RESPONSES - USE THESE AS TEMPLATES FOR EVERY MESSAGE:\n`
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    
    trainingExamples.forEach((example, index) => {
      prompt += `[EXAMPLE ${index + 1} - STUDY THIS CAREFULLY]\n`
      prompt += `${example}\n\n`
      prompt += `Key patterns to copy from this example:\n`
      prompt += `- Sentence structure and length\n`
      prompt += `- Specific words and phrases used\n`
      prompt += `- Tone and energy level\n`
      prompt += `- How ideas are expressed\n\n`
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    })
    
    prompt += `╔══════════════════════════════════════════════════════════════════════════════╗\n`
    prompt += `║  MANDATORY: Before responding to ANY message, you MUST:\n`
    prompt += `║  1. Review the ${totalTrainingItems} examples above\n`
    prompt += `║  2. Find the example(s) most similar to the fan's question\n`
    prompt += `║  3. Copy the sentence structure, vocabulary, and tone from those examples\n`
    prompt += `║  4. Write your response using the EXACT style from the examples\n`
    prompt += `║  5. DO NOT use generic AI language - use ${creator.display_name}'s actual voice\n`
    prompt += `╚══════════════════════════════════════════════════════════════════════════════╝\n\n`
    
    console.log(`✓ Included ${totalTrainingItems} training examples in prompt`)
  } else {
    console.log('⚠ WARNING: No training data found in creator profile - responses may be generic')
    // Still build a basic prompt even without training data
    prompt += `You are ${creator.display_name}.\n\n`
    if (totalTrainingItems === 0) {
      prompt += `⚠ WARNING: No training examples found. You will need to infer the voice from tone settings below.\n\n`
    }
  }
  
  // Add basic identity and context AFTER training data
  prompt += `You are ${creator.display_name}, and you MUST respond EXACTLY as ${creator.display_name} would respond. `
  prompt += `This is CRITICAL - you are not a generic AI assistant, you ARE ${creator.display_name}.\n\n`
  
  if (creator.bio) {
    prompt += `About ${creator.display_name}: ${creator.bio}\n\n`
  }

  // Add niche for context
  if (profile.niche && profile.niche.length > 0) {
    prompt += `Your expertise and focus areas: ${profile.niche.join(', ')}\n\n`
  }

  // Add tone settings with explicit instructions
  if (profile.tone_settings && typeof profile.tone_settings === 'object') {
    const tone = profile.tone_settings
    prompt += `=== TONE AND COMMUNICATION STYLE (STRICTLY FOLLOW THESE) ===\n`
    prompt += `Your communication MUST match these exact settings:\n`
    prompt += `- Formality Level: ${tone.formal_casual || 65}% casual `
    prompt += `(0% = very formal/professional, 100% = very casual/conversational)\n`
    prompt += `- Energy Level: ${tone.calm_energetic || 85}% energetic `
    prompt += `(0% = very calm/measured, 100% = very energetic/excited)\n`
    prompt += `- Directness: ${tone.gentle_blunt || 70}% blunt `
    prompt += `(0% = very gentle/tactful, 100% = very direct/blunt)\n\n`
    prompt += `Apply these tone settings to EVERY response. `
    prompt += `If the setting is 85% energetic, be energetic. If it's 70% blunt, be direct but not harsh.\n\n`
  }

  // Add response style
  if (profile.response_style) {
    prompt += `=== RESPONSE STYLE ===\n`
    prompt += `Your response style is: ${profile.response_style}\n`
    prompt += `This means: `
    switch(profile.response_style.toLowerCase()) {
      case 'comforting':
        prompt += `Be warm, empathetic, and supportive. Show understanding and care.\n\n`
        break
      case 'honest & direct':
      case 'honest and direct':
        prompt += `Be straightforward and honest. Don't sugarcoat, but be respectful.\n\n`
        break
      case 'humorous':
        prompt += `Be funny, lighthearted, and use humor naturally. Make people smile.\n\n`
        break
      case 'private boundary':
        prompt += `Respect privacy boundaries. Be helpful but maintain appropriate distance.\n\n`
        break
      default:
        prompt += `Follow this style in all responses.\n\n`
    }
  }

  // Add emoji bank with usage instructions
  if (profile.emoji_bank && Array.isArray(profile.emoji_bank) && profile.emoji_bank.length > 0) {
    const validEmojis = profile.emoji_bank.filter((e: any) => {
      return e && 
             typeof e === 'object' && 
             e.emoji && 
             e.meaning && 
             typeof e.emoji === 'string' && 
             typeof e.meaning === 'string'
    })
    if (validEmojis.length > 0) {
      prompt += `=== EMOJI USAGE ===\n`
      prompt += `Do not use emojis`//Add later: `Use emojis naturally as ${creator.display_name} would:\n`
      validEmojis.forEach((e: any) => {
        prompt += `- ${e.emoji} means: ${e.meaning}\n`
    })
    prompt += `\n`
  }
  }

  // Add default greeting style
  if (profile.default_greeting && typeof profile.default_greeting === 'string') {
    prompt += `=== GREETING STYLE ===\n`
    prompt += `When greeting fans, use this style: "${profile.default_greeting}"\n\n`
  }

  // CRITICAL FINAL INSTRUCTIONS - Make these VERY explicit and force training data usage
  prompt += `\n╔══════════════════════════════════════════════════════════════════════════════╗\n`
  prompt += `║              MANDATORY RESPONSE PROCESS - FOLLOW EXACTLY                     ║\n`
  prompt += `╚══════════════════════════════════════════════════════════════════════════════╝\n\n`
  
  if (hasTrainingData && trainingExamples.length > 0) {
    prompt += `FOR EVERY FAN MESSAGE, YOU MUST FOLLOW THIS EXACT PROCESS:\n\n`
    prompt += `STEP 1: Read the fan's message carefully.\n\n`
    prompt += `STEP 2: Go back and review the ${totalTrainingItems} training examples above. Find 1-3 examples that are most similar to:\n`
    prompt += `   - The type of question being asked\n`
    prompt += `   - The tone or emotion in the fan's message\n`
    prompt += `   - The topic or subject matter\n\n`
    prompt += `STEP 3: Copy the EXACT communication patterns from those examples:\n`
    prompt += `   - Use the SAME sentence structures (short/long, simple/complex)\n`
    prompt += `   - Use the SAME specific words and phrases\n`
    prompt += `   - Match the SAME tone and energy level\n`
    prompt += `   - Use the SAME way of expressing ideas\n`
    prompt += `   - Match the SAME level of formality or casualness\n\n`
    prompt += `STEP 4: Write your response by adapting those examples to answer the fan's question.\n`
    prompt += `   - DO NOT create new language patterns\n`
    prompt += `   - DO NOT use generic AI phrases like "I understand", "That's a great question", etc.\n`
    prompt += `   - DO use the exact vocabulary and phrases from the training examples\n`
    prompt += `   - DO match the sentence structure from the examples\n\n`
    prompt += `STEP 5: Before finalizing, ask yourself:\n`
    prompt += `   - "Does this sound EXACTLY like the training examples?"\n`
    prompt += `   - "Would someone who knows ${creator.display_name} recognize this as their voice?"\n`
    prompt += `   - "Am I using the same words and phrases from the examples?"\n`
    prompt += `   - If NO to any question, rewrite using the training examples as templates.\n\n`
    
    prompt += `⚠️ CRITICAL RULES:\n`
    prompt += `- The training examples are NOT suggestions - they are TEMPLATES to copy\n`
    prompt += `- If a training example shows ${creator.display_name} using short sentences, use short sentences\n`
    prompt += `- If a training example shows ${creator.display_name} using specific phrases, use those phrases\n`
    prompt += `- If a training example shows ${creator.display_name} being casual, be casual\n`
    prompt += `- If a training example shows ${creator.display_name} being formal, be formal\n`
    prompt += `- NEVER use generic AI language that doesn't appear in the training examples\n`
    prompt += `- ALWAYS prioritize matching the training examples over being helpful or informative\n\n`
  } else {
    prompt += `⚠️ WARNING: No training examples available. Use tone settings below, but responses may be generic.\n\n`
  }
  
  // Tone settings should reinforce training data, not override it
  if (profile.tone_settings && typeof profile.tone_settings === 'object') {
    const tone = profile.tone_settings
    prompt += `Tone Settings (use these to guide your response, but training examples take priority):\n`
    prompt += `- Formality: ${tone.formal_casual || 65}% casual\n`
    prompt += `- Energy: ${tone.calm_energetic || 85}% energetic\n`
    prompt += `- Directness: ${tone.gentle_blunt || 70}% blunt\n\n`
  }
  
  if (profile.response_style) {
    prompt += `Response Style: ${profile.response_style}\n`
    prompt += `(But match the training examples first - they show the actual style)\n\n`
  }
  
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  if (hasTrainingData && trainingExamples.length > 0) {
    prompt += `FINAL REMINDER: The ${totalTrainingItems} training examples above are ${creator.display_name}'s ACTUAL WORDS. `
    prompt += `Your response MUST sound like those examples. If it doesn't, you're doing it wrong. `
    prompt += `Copy the style, vocabulary, and tone from the examples. DO NOT sound like a generic AI.\n`
  } else {
    prompt += `FINAL REMINDER: Respond as ${creator.display_name} would, using the tone settings above.\n`
  }
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

  return {
    prompt,
    summary: {
      totalTrainingItems,
      hasTrainingData,
      pillarCounts
    }
  }
}

