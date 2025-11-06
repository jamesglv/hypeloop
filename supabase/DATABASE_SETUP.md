# Database Setup Summary

## Overview

This project uses Supabase as the backend with a serverless-first architecture. All database tables, functions, and realtime subscriptions are configured.

## Database Tables

### 1. `creators`
- Stores creator user profiles
- References `auth.users`
- Fields: `id`, `display_name`, `username`, `bio`, `created_at`, `updated_at`

### 2. `fans`
- Stores fan user profiles  
- References `auth.users`
- Fields: `id`, `display_name`, `username`, `created_at`, `updated_at`

### 3. `creator_profiles`
- Extended creator information with tone, personality, niche, training data
- References `creators`
- Stores: tone settings, training pillars (voice, humor, expertise, story, community), emoji bank, privacy settings

### 4. `subscriptions`
- Fan subscriptions to creators
- References `fans` and `creators`
- Fields: tier, price, status, Stripe integration, billing periods
- Enforces one active subscription per fan-creator pair

### 5. `messages`
- Chat logs between fans and creators (via AI)
- References `subscriptions`, `fans`, `creators`
- Fields: content, role (fan/ai), AI metadata, approval status, threading
- **Realtime enabled** for live updates

### 6. `creator_training`
- Q&A pairs and training data for AI prompts
- References `creators`
- Organized by pillar: voice, humor, expertise, story, community
- Tracks completion status

### 7. `uploads`
- Optional file uploads (CSVs, transcripts, DMs)
- References `creators`
- Stores file metadata and processing status

## Helper Functions

### `get_creator_training_progress(creator_id)`
Returns training completion percentage (0-100)

### `build_creator_ai_prompt(creator_id)`
Builds AI prompt from creator profile and training data

### `get_creator_subscriber_count(creator_id)`
Returns count of active subscribers

### `get_creator_monthly_revenue(creator_id)`
Calculates monthly recurring revenue

### `update_creator_training_completion(creator_id)`
Updates training completion percentage automatically

## Storage Setup

### Profile Pictures Bucket

To enable profile picture uploads, you need to set up the storage bucket and RLS policies:

**Option 1: Run the migration (Recommended)**
```bash
# Run the migration file
supabase migration up
```

Or manually run the SQL in `supabase/migrations/20251106123130_setup_profile_pictures_storage.sql` via the Supabase Dashboard SQL Editor.

**Option 2: Manual setup via Dashboard**

1. Go to **Storage** in your Supabase Dashboard
2. Click **New bucket**
3. Create bucket with:
   - Name: `profile-pictures`
   - Public bucket: **Yes** (enabled)
   - File size limit: `5242880` (5MB)
   - Allowed MIME types: `image/jpeg,image/png,image/gif,image/webp,image/svg+xml`
4. Go to **Storage** → **Policies** → **profile-pictures**
5. Add the following policies (run the SQL from the migration file)

The migration sets up:
- Storage bucket: `profile-pictures`
- RLS policies allowing users to upload/update/delete files in their own folder (`{user-id}/filename`)
- Public read access for all profile pictures

## Edge Functions

Located in `supabase/functions/`:

1. **generate-ai-response** - Generates AI responses using OpenAI
2. **store-chat-memory** - Retrieves conversation history
3. **manage-subscription** - Handles subscription CRUD operations

See `EDGE_FUNCTIONS_SETUP.md` for detailed documentation.

## Realtime Subscriptions

Enabled for:
- `messages` - Live chat updates
- `subscriptions` - Live subscription status
- `creator_profiles` - Live profile updates

See `REALTIME_SETUP.md` for usage examples.

## Row Level Security (RLS)

All tables have RLS enabled with policies:
- Users can view their own data
- Creators can view data related to them
- Fans can view their own subscriptions and messages
- System/service role can perform operations for webhooks

## Migration Files

All migrations are in `supabase/migrations/`:
- `20251106113620_create_creators_table.sql`
- `20251106114309_migrate_profiles_to_creators.sql`
- `20251106123122_create_fans_table.sql`
- `20251106123123_create_creator_profiles_table.sql`
- `20251106123124_create_subscriptions_table.sql`
- `20251106123125_create_messages_table.sql`
- `20251106123126_create_creator_training_table.sql`
- `20251106123127_create_uploads_table.sql`
- `20251106123128_create_helper_functions.sql`
- `20251106123129_enable_realtime.sql`

## Next Steps

1. Run migrations in Supabase Dashboard or via CLI
2. Set up Edge Functions environment variables (OPENAI_API_KEY)
3. Deploy Edge Functions
4. Test Realtime subscriptions in frontend
5. Connect frontend components to database

## Useful Queries

```sql
-- Get creator with profile and training data
SELECT 
  c.*,
  cp.*,
  COUNT(DISTINCT s.id) as subscriber_count,
  SUM(s.price_per_month) as monthly_revenue
FROM creators c
LEFT JOIN creator_profiles cp ON c.id = cp.id
LEFT JOIN subscriptions s ON c.id = s.creator_id AND s.status = 'active'
WHERE c.id = $1
GROUP BY c.id, cp.id;

-- Get conversation thread
SELECT *
FROM messages
WHERE subscription_id = $1
ORDER BY created_at ASC;

-- Get creator training progress
SELECT 
  pillar,
  COUNT(*) FILTER (WHERE is_complete = true) as answered,
  COUNT(*) as total
FROM creator_training
WHERE creator_id = $1
GROUP BY pillar;
```

