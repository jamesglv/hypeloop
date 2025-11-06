-- Create creator_profiles table for extended creator information
-- This stores tone, personality, niche, examples, and training data
CREATE TABLE IF NOT EXISTS public.creator_profiles (
  id UUID REFERENCES public.creators(id) ON DELETE CASCADE PRIMARY KEY,
  
  -- Profile information
  niche TEXT[],
  profile_picture_url TEXT,
  
  -- Tone and personality settings
  tone_settings JSONB DEFAULT '{}'::jsonb, -- Stores tone sliders, humor level, emoji frequency, etc.
  default_greeting TEXT,
  response_style TEXT, -- 'Comforting', 'Honest & Direct', 'Humorous', 'Private Boundary'
  
  -- Voice & Personality training data
  voice_personality JSONB DEFAULT '[]'::jsonb, -- Array of Q&A pairs for voice pillar
  humor_human_touch JSONB DEFAULT '[]'::jsonb, -- Array of Q&A pairs for humor pillar
  expertise_knowledge JSONB DEFAULT '[]'::jsonb, -- Array of Q&A pairs for expertise pillar
  story_credibility JSONB DEFAULT '[]'::jsonb, -- Array of Q&A pairs for story pillar
  community_culture JSONB DEFAULT '[]'::jsonb, -- Array of Q&A pairs for community pillar
  
  -- Emoji bank
  emoji_bank JSONB DEFAULT '[]'::jsonb, -- Array of {emoji: string, meaning: string}
  
  -- Privacy & access settings
  approve_messages_before_ai BOOLEAN DEFAULT false,
  allow_fans_to_see_training_updates BOOLEAN DEFAULT true,
  
  -- Training completion
  training_completion_percentage INTEGER DEFAULT 0,
  training_completed_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.creator_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Creator profiles are viewable by everyone (for fan discovery)
CREATE POLICY "Creator profiles are viewable by everyone"
  ON public.creator_profiles
  FOR SELECT
  USING (true);

-- Policy: Creators can insert their own profile
CREATE POLICY "Creators can insert their own profile"
  ON public.creator_profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Creators can update their own profile
CREATE POLICY "Creators can update their own profile"
  ON public.creator_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Creators can delete their own profile
CREATE POLICY "Creators can delete their own profile"
  ON public.creator_profiles
  FOR DELETE
  USING (auth.uid() = id);

-- Trigger to automatically update updated_at
CREATE TRIGGER set_creator_profiles_updated_at
  BEFORE UPDATE ON public.creator_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Index for faster lookups by niche
CREATE INDEX IF NOT EXISTS creator_profiles_niche_idx ON public.creator_profiles USING GIN(niche);

