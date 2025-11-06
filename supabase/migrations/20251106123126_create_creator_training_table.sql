-- Create creator_training table for Q&A pairs and prompt templates
-- This stores the training data that feeds into AI prompts
CREATE TABLE IF NOT EXISTS public.creator_training (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
  
  -- Training pillar/category
  pillar TEXT NOT NULL, -- 'voice', 'humor', 'expertise', 'story', 'community'
  
  -- Question and answer
  question TEXT NOT NULL,
  answer TEXT,
  placeholder TEXT, -- Suggested placeholder text for the question
  
  -- Training metadata
  answered_at TIMESTAMP WITH TIME ZONE,
  is_complete BOOLEAN DEFAULT false,
  
  -- Order for display
  display_order INTEGER DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS creator_training_creator_id_idx ON public.creator_training(creator_id);
CREATE INDEX IF NOT EXISTS creator_training_pillar_idx ON public.creator_training(pillar);
CREATE INDEX IF NOT EXISTS creator_training_is_complete_idx ON public.creator_training(is_complete);

-- Enable Row Level Security
ALTER TABLE public.creator_training ENABLE ROW LEVEL SECURITY;

-- Policy: Creators can view their own training data
CREATE POLICY "Creators can view their own training"
  ON public.creator_training
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Policy: Creators can insert their own training data
CREATE POLICY "Creators can insert their own training"
  ON public.creator_training
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Policy: Creators can update their own training data
CREATE POLICY "Creators can update their own training"
  ON public.creator_training
  FOR UPDATE
  USING (auth.uid() = creator_id);

-- Policy: Creators can delete their own training data
CREATE POLICY "Creators can delete their own training"
  ON public.creator_training
  FOR DELETE
  USING (auth.uid() = creator_id);

-- Trigger to automatically update updated_at
CREATE TRIGGER set_creator_training_updated_at
  BEFORE UPDATE ON public.creator_training
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Trigger to update is_complete and answered_at when answer is provided
CREATE OR REPLACE FUNCTION public.update_training_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.answer IS NOT NULL AND TRIM(NEW.answer) != '' THEN
    NEW.is_complete = true;
    IF NEW.answered_at IS NULL THEN
      NEW.answered_at = TIMEZONE('utc'::text, NOW());
    END IF;
  ELSE
    NEW.is_complete = false;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_training_completion_trigger
  BEFORE INSERT OR UPDATE ON public.creator_training
  FOR EACH ROW EXECUTE FUNCTION public.update_training_completion();

