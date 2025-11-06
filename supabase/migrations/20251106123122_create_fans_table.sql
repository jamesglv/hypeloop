-- Create fans table for users who are fans (not creators)
-- Fans use auth.users, but we track fan-specific data here
CREATE TABLE IF NOT EXISTS public.fans (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT,
  username TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS fans_username_idx ON public.fans(username);

-- Enable Row Level Security
ALTER TABLE public.fans ENABLE ROW LEVEL SECURITY;

-- Policy: Fans can view other fans (for discovery)
CREATE POLICY "Fans are viewable by everyone"
  ON public.fans
  FOR SELECT
  USING (true);

-- Policy: Users can insert their own fan profile
CREATE POLICY "Users can insert their own fan profile"
  ON public.fans
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own fan profile
CREATE POLICY "Users can update their own fan profile"
  ON public.fans
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can delete their own fan profile
CREATE POLICY "Users can delete their own fan profile"
  ON public.fans
  FOR DELETE
  USING (auth.uid() = id);

-- Trigger to automatically update updated_at
CREATE TRIGGER set_fans_updated_at
  BEFORE UPDATE ON public.fans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

