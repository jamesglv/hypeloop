-- Create messages table for chat logs between fans and creators (via AI)
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  fan_id UUID REFERENCES public.fans(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
  
  -- Message content
  content TEXT NOT NULL,
  role TEXT NOT NULL, -- 'fan' or 'ai' (representing the creator's AI)
  
  -- AI message metadata
  is_ai_generated BOOLEAN DEFAULT false,
  ai_prompt_used TEXT, -- Store the prompt that was used to generate this message
  ai_model_used TEXT, -- Store which AI model was used
  ai_tokens_used INTEGER, -- Track token usage for cost analysis
  
  -- Message status
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'pending_approval', 'approved', 'rejected'
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id),
  
  -- Threading support
  parent_message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  thread_id UUID, -- Group messages in a conversation thread
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS messages_subscription_id_idx ON public.messages(subscription_id);
CREATE INDEX IF NOT EXISTS messages_fan_id_idx ON public.messages(fan_id);
CREATE INDEX IF NOT EXISTS messages_creator_id_idx ON public.messages(creator_id);
CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON public.messages(thread_id);
CREATE INDEX IF NOT EXISTS messages_parent_message_id_idx ON public.messages(parent_message_id);
CREATE INDEX IF NOT EXISTS messages_created_at_idx ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS messages_status_idx ON public.messages(status);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Policy: Fans can view messages in their conversations
CREATE POLICY "Fans can view their messages"
  ON public.messages
  FOR SELECT
  USING (auth.uid() = fan_id);

-- Policy: Creators can view messages to them
CREATE POLICY "Creators can view messages to them"
  ON public.messages
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Policy: Fans can create messages
CREATE POLICY "Fans can create messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (auth.uid() = fan_id);

-- Policy: Creators can update messages (for approval/rejection)
CREATE POLICY "Creators can update their messages"
  ON public.messages
  FOR UPDATE
  USING (auth.uid() = creator_id);

-- Policy: System can insert AI-generated messages
CREATE POLICY "System can insert AI messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (is_ai_generated = true); -- Note: In production, restrict this to service role

-- Trigger to automatically update updated_at
CREATE TRIGGER set_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Enable Realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

