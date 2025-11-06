-- Helper functions for common database operations

-- Function to get creator's training progress percentage
CREATE OR REPLACE FUNCTION public.get_creator_training_progress(p_creator_id UUID)
RETURNS INTEGER AS $$
DECLARE
  total_questions INTEGER;
  answered_questions INTEGER;
  progress_percentage INTEGER;
BEGIN
  -- Count total questions (assuming 5 questions per pillar, 5 pillars = 25 total)
  SELECT COUNT(*) INTO total_questions
  FROM public.creator_training
  WHERE creator_id = p_creator_id;
  
  -- Count answered questions
  SELECT COUNT(*) INTO answered_questions
  FROM public.creator_training
  WHERE creator_id = p_creator_id
    AND is_complete = true;
  
  -- Calculate percentage
  IF total_questions > 0 THEN
    progress_percentage := ROUND((answered_questions::DECIMAL / total_questions::DECIMAL) * 100);
  ELSE
    progress_percentage := 0;
  END IF;
  
  RETURN progress_percentage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to build AI prompt from creator profile
CREATE OR REPLACE FUNCTION public.build_creator_ai_prompt(p_creator_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_profile JSONB;
  v_prompt TEXT;
BEGIN
  -- Get creator profile
  SELECT 
    jsonb_build_object(
      'name', c.display_name,
      'bio', c.bio,
      'niche', cp.niche,
      'tone_settings', cp.tone_settings,
      'default_greeting', cp.default_greeting,
      'response_style', cp.response_style,
      'voice_personality', cp.voice_personality,
      'humor_human_touch', cp.humor_human_touch,
      'expertise_knowledge', cp.expertise_knowledge,
      'story_credibility', cp.story_credibility,
      'community_culture', cp.community_culture,
      'emoji_bank', cp.emoji_bank
    ) INTO v_profile
  FROM public.creators c
  LEFT JOIN public.creator_profiles cp ON c.id = cp.id
  WHERE c.id = p_creator_id;
  
  -- Build prompt (this is a simplified version - you'll expand this in Edge Functions)
  v_prompt := 'You are ' || (v_profile->>'name') || '. ' || 
              COALESCE(v_profile->>'bio', '') || 
              ' Respond in their voice and style based on the training data provided.';
  
  RETURN v_prompt;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get active subscription count for a creator
CREATE OR REPLACE FUNCTION public.get_creator_subscriber_count(p_creator_id UUID)
RETURNS INTEGER AS $$
DECLARE
  subscriber_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO subscriber_count
  FROM public.subscriptions
  WHERE creator_id = p_creator_id
    AND status = 'active';
  
  RETURN COALESCE(subscriber_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get creator's monthly revenue
CREATE OR REPLACE FUNCTION public.get_creator_monthly_revenue(p_creator_id UUID)
RETURNS DECIMAL(10, 2) AS $$
DECLARE
  monthly_revenue DECIMAL(10, 2);
BEGIN
  SELECT COALESCE(SUM(price_per_month), 0) INTO monthly_revenue
  FROM public.subscriptions
  WHERE creator_id = p_creator_id
    AND status = 'active';
  
  RETURN monthly_revenue;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update creator profile training completion
CREATE OR REPLACE FUNCTION public.update_creator_training_completion(p_creator_id UUID)
RETURNS VOID AS $$
DECLARE
  progress_percentage INTEGER;
BEGIN
  -- Get training progress
  progress_percentage := public.get_creator_training_progress(p_creator_id);
  
  -- Update creator profile
  UPDATE public.creator_profiles
  SET 
    training_completion_percentage = progress_percentage,
    training_completed_at = CASE 
      WHEN progress_percentage = 100 AND training_completed_at IS NULL 
      THEN TIMEZONE('utc'::text, NOW())
      ELSE training_completed_at
    END
  WHERE id = p_creator_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

