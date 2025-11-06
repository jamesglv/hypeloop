-- Add unique constraint to username column in fans table
-- This ensures that usernames are unique across all fans, similar to the creators table

-- Drop the existing index since the unique constraint will create a unique index
DROP INDEX IF EXISTS public.fans_username_idx;

-- Add unique constraint to username column
-- Note: This will fail if there are duplicate usernames in the table
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fans_username_unique'
  ) THEN
    ALTER TABLE public.fans 
      ADD CONSTRAINT fans_username_unique UNIQUE (username);
  END IF;
END $$;

