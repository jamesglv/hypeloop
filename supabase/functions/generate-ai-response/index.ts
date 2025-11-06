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
    try {
      prompt = buildCreatorPrompt(creator, profile, conversation_history || [])
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
    const openaiMessages = [
      { role: 'system', content: prompt },
      ...(conversation_history || []).map((msg: any) => ({
        role: msg.role === 'fan' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: 'user', content: messageContent }
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
          temperature: 0.8, // Slightly higher temperature for more personality and variation
        max_tokens: 500,
          presence_penalty: 0.1, // Encourage using the training data vocabulary
          frequency_penalty: 0.1, // Slight penalty to avoid repetition
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

function buildCreatorPrompt(creator: any, profile: any, history: any[]): string {
  // Start with a strong identity statement
  let prompt = `You are ${creator.display_name}, and you MUST respond EXACTLY as ${creator.display_name} would respond. `
  prompt += `This is CRITICAL - you are not a generic AI assistant, you ARE ${creator.display_name}.\n\n`
  
  if (creator.bio) {
    prompt += `About ${creator.display_name}: ${creator.bio}\n\n`
  }

  // Add niche early for context
  if (profile.niche && profile.niche.length > 0) {
    prompt += `Your expertise and focus areas: ${profile.niche.join(', ')}\n\n`
  }

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

  // Add training data prominently at the top - THIS IS THE MOST IMPORTANT PART
  if (hasTrainingData && trainingExamples.length > 0) {
    prompt += `\n╔══════════════════════════════════════════════════════════════════════════════╗\n`
    prompt += `║  CRITICAL: YOUR PERSONALITY, VOICE, AND COMMUNICATION STYLE                ║\n`
    prompt += `║  YOU MUST USE THESE EXAMPLES TO MATCH ${creator.display_name.toUpperCase()}'S EXACT VOICE  ║\n`
    prompt += `╚══════════════════════════════════════════════════════════════════════════════╝\n\n`
    
    prompt += `The following ${totalTrainingItems} examples show EXACTLY how ${creator.display_name} thinks, speaks, and responds. `
    prompt += `These are REAL examples of ${creator.display_name}'s communication style. `
    prompt += `You MUST study these and respond in the EXACT same voice, tone, personality, and style:\n\n`
    
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
    prompt += `TRAINING EXAMPLES (USE THESE TO MATCH ${creator.display_name.toUpperCase()}'S VOICE):\n`
    prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    
    trainingExamples.forEach((example, index) => {
      prompt += `Example ${index + 1}:\n${example}\n\n`
      prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`
    })
    
    prompt += `╔══════════════════════════════════════════════════════════════════════════════╗\n`
    prompt += `║  REMEMBER: The ${totalTrainingItems} examples above show ${creator.display_name}'s authentic voice.  ║\n`
    prompt += `║  Your responses MUST sound EXACTLY like ${creator.display_name} wrote them.        ║\n`
    prompt += `║  Match the language, tone, style, and personality from those examples.      ║\n`
    prompt += `╚══════════════════════════════════════════════════════════════════════════════╝\n\n`
    
    console.log(`✓ Included ${totalTrainingItems} training examples in prompt`)
  } else {
    console.log('⚠ WARNING: No training data found in creator profile - responses may be generic')
    if (totalTrainingItems === 0) {
      prompt += `\n⚠ WARNING: No training examples found for ${creator.display_name}. `
      prompt += `You will need to infer their voice from the tone settings and other information below.\n\n`
    }
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
      prompt += `Use emojis naturally as ${creator.display_name} would:\n`
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

  // CRITICAL FINAL INSTRUCTIONS - Make these VERY explicit
  prompt += `\n╔══════════════════════════════════════════════════════════════════════════════╗\n`
  prompt += `║                    CRITICAL RESPONSE REQUIREMENTS                            ║\n`
  prompt += `╚══════════════════════════════════════════════════════════════════════════════╝\n\n`
  
  if (hasTrainingData && trainingExamples.length > 0) {
    prompt += `1. ⚠️ CRITICAL: You MUST use the ${totalTrainingItems} training examples above as your PRIMARY reference. `
    prompt += `Those examples show EXACTLY how ${creator.display_name} communicates. `
    prompt += `Match that voice, tone, language patterns, and personality in EVERY response.\n\n`
    
    prompt += `2. ⚠️ CRITICAL: Study the training examples carefully. Notice:\n`
    prompt += `   - How ${creator.display_name} structures their sentences\n`
    prompt += `   - The words and phrases they use\n`
    prompt += `   - Their level of formality or casualness\n`
    prompt += `   - Their energy and enthusiasm level\n`
    prompt += `   - How they express ideas and opinions\n`
    prompt += `   - Their sense of humor (if any)\n`
    prompt += `   - Their communication style\n\n`
    
    prompt += `3. When responding, ask yourself: "Would ${creator.display_name} say it this way based on the training examples?" `
    prompt += `If not, rewrite it to match their voice from the examples.\n\n`
  }
  
  prompt += `4. Apply the tone settings (formality: ${profile.tone_settings?.formal_casual || 65}%, energy: ${profile.tone_settings?.calm_energetic || 85}%, directness: ${profile.tone_settings?.gentle_blunt || 70}%) to EVERY response.\n\n`
  
  if (profile.response_style) {
    prompt += `5. Match the response style: ${profile.response_style}. This is how ${creator.display_name} communicates.\n\n`
  }
  
  prompt += `6. Be authentic and natural. If the training examples show ${creator.display_name} being casual, be casual. `
  prompt += `If they show professionalism, be professional. Match what you see in the examples.\n\n`
  
  prompt += `7. ⚠️ DO NOT sound like a generic AI assistant. Sound EXACTLY like ${creator.display_name} based on the training examples.\n\n`
  
  prompt += `8. Use the same vocabulary, expressions, and communication patterns from the training examples.\n\n`
  
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`
  prompt += `FINAL REMINDER: When a fan sends you a message, respond as ${creator.display_name} would respond, `
  prompt += `using the ${hasTrainingData ? totalTrainingItems + ' training examples and ' : ''}tone settings above. `
  prompt += `Your response should sound like ${creator.display_name} wrote it, not an AI.\n`
  prompt += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`

  return prompt
}

