-- Allow creators to insert messages (for manual responses)
-- This policy allows creators to insert messages where they are the creator_id
-- and the role is 'ai' (representing their AI responses)

CREATE POLICY "Creators can insert their own AI messages"
  ON public.messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id 
    AND role = 'ai'
  );

