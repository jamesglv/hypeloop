# Supabase Profiles Table Setup

This guide will help you set up the profiles table in your Supabase project.

## Option 1: Using Supabase Dashboard (Recommended for beginners)

1. **Go to your Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your project

2. **Navigate to SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the SQL Script**
   - Copy and paste the contents of `supabase-schema.sql`
   - Click "Run" or press `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows)

4. **Verify the Table**
   - Go to "Table Editor" in the left sidebar
   - You should see a `profiles` table with the following columns:
     - `id` (UUID, primary key)
     - `display_name` (text)
     - `username` (text, unique)
     - `bio` (text)
     - `created_at` (timestamp)
     - `updated_at` (timestamp)

5. **Check Row Level Security (RLS)**
   - Click on the `profiles` table
   - Go to the "Policies" tab
   - You should see 4 policies:
     - Profiles are viewable by everyone (SELECT)
     - Users can insert their own profile (INSERT)
     - Users can update their own profile (UPDATE)
     - Users can delete their own profile (DELETE)

## Option 2: Using Supabase CLI

If you have the Supabase CLI installed:

```bash
# Initialize Supabase (if not already done)
supabase init

# Link to your project (if not already linked)
supabase link --project-ref your-project-ref

# Run the migration
supabase db push
```

Or create a migration file:

```bash
supabase migration new create_profiles_table
```

Then copy the SQL from `supabase-schema.sql` into the migration file and run:

```bash
supabase db push
```

## What This Schema Does

1. **Creates the profiles table** with columns for user profile data
2. **Sets up Row Level Security (RLS)** so users can only modify their own profiles
3. **Creates an index** on username for faster lookups
4. **Auto-creates a profile** when a new user signs up (via trigger)
5. **Auto-updates the updated_at timestamp** when a profile is modified

## Testing

After running the SQL, you can test by:

1. Signing up a new user in your app
2. Checking the `profiles` table in Supabase - you should see a new row
3. Updating the profile in your app
4. Verifying the changes appear in the table

## Troubleshooting

- **If you get permission errors**: Make sure RLS policies are set up correctly
- **If the trigger doesn't work**: Check that the function has `SECURITY DEFINER` and the trigger is properly attached
- **If username conflicts occur**: The unique constraint will prevent duplicate usernames

