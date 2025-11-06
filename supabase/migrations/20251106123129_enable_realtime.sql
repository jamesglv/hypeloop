-- Enable Realtime for tables that need live updates
-- Realtime is already enabled for messages table in the messages migration

-- Enable Realtime for subscriptions (for live subscription updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;

-- Enable Realtime for creator_profiles (for live profile updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.creator_profiles;

-- Note: Realtime is enabled by default for tables, but we explicitly add them
-- to the supabase_realtime publication for clarity and control

-- To use Realtime in your frontend:
-- import { RealtimeChannel } from '@supabase/supabase-js'
-- 
-- const channel = supabase
--   .channel('messages')
--   .on('postgres_changes', 
--     { 
--       event: 'INSERT', 
--       schema: 'public', 
--       table: 'messages',
--       filter: `creator_id=eq.${creatorId}`
--     }, 
--     (payload) => {
--       console.log('New message:', payload.new)
--     }
--   )
--   .subscribe()

