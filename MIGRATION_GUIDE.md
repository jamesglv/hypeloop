# Running Supabase Migrations

## Option 1: Using Supabase Dashboard (Easiest)

1. **Go to your Supabase Dashboard**
   - Visit https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run the Migration**
   - Copy the entire contents of `supabase-schema.sql`
   - Paste into the SQL Editor
   - Click "Run" (or press `Cmd+Enter` on Mac / `Ctrl+Enter` on Windows)

4. **Verify Success**
   - You should see a success message
   - Go to "Table Editor" → you should see the `profiles` table
   - Check the "Policies" tab to see RLS policies

## Option 2: Using Supabase CLI (Recommended for Production)

### Install Supabase CLI

**macOS (using Homebrew):**
```bash
brew install supabase/tap/supabase
```

**macOS/Linux (using npm):**
```bash
npm install -g supabase
```

**Windows (using Scoop):**
```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### Set Up Migrations

1. **Initialize Supabase in your project (if not already done):**
```bash
cd /Users/james/Development/hype-loop
supabase init
```

2. **Link to your remote project:**
```bash
supabase link --project-ref your-project-ref
```
   - Find your project ref in Supabase Dashboard → Settings → General → Reference ID

3. **Create a migration file:**
```bash
supabase migration new create_profiles_table
```
   This creates a file like: `supabase/migrations/YYYYMMDDHHMMSS_create_profiles_table.sql`

4. **Copy the SQL:**
```bash
cp supabase-schema.sql supabase/migrations/YYYYMMDDHHMMSS_create_profiles_table.sql
```
   (Replace YYYYMMDDHHMMSS with the actual timestamp from the migration file)

5. **Push the migration:**
```bash
supabase db push
```

### Alternative: Direct SQL Execution via CLI

If you just want to run the SQL file directly without creating a migration:

```bash
# Link to your project first
supabase link --project-ref your-project-ref

# Run the SQL file
supabase db execute --file supabase-schema.sql
```

## Option 3: Using Supabase CLI with Local Development

If you want to test locally first:

1. **Start local Supabase:**
```bash
supabase start
```

2. **Run migration locally:**
```bash
supabase db reset  # This will run all migrations
# OR
supabase migration up
```

3. **Push to remote:**
```bash
supabase db push
```

## Verifying the Migration

After running the migration, verify it worked:

1. **Check the table exists:**
   - Go to Table Editor in Supabase Dashboard
   - You should see `profiles` table with columns: id, display_name, username, bio, created_at, updated_at

2. **Check RLS policies:**
   - Click on `profiles` table → "Policies" tab
   - You should see 4 policies

3. **Test from your app:**
   - Sign up a new user
   - Complete the profile setup
   - Check the `profiles` table to see the new row

## Troubleshooting

- **"relation already exists"**: The table already exists. You can either drop it first or modify the SQL to use `CREATE TABLE IF NOT EXISTS` (which we already have)

- **Permission errors**: Make sure you're logged into Supabase CLI and have the correct permissions

- **Migration conflicts**: If you've already run parts of this migration, you may need to remove duplicate statements

