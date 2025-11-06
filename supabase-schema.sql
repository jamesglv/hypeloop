-- Create creators table
CREATE TABLE IF NOT EXISTS public.creators (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS creators_username_idx ON public.creators(username);

-- Enable Row Level Security
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all creators (for discovery)
CREATE POLICY "Creators are viewable by everyone"
  ON public.creators
  FOR SELECT
  USING (true);

-- Policy: Users can insert their own creator profile
CREATE POLICY "Users can insert their own creator profile"
  ON public.creators
  FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Policy: Users can update their own creator profile
CREATE POLICY "Users can update their own creator profile"
  ON public.creators
  FOR UPDATE
  USING (auth.uid() = id);

-- Policy: Users can delete their own creator profile
CREATE POLICY "Users can delete their own creator profile"
  ON public.creators
  FOR DELETE
  USING (auth.uid() = id);

-- Function to automatically create creator profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_creator()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.creators (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create creator profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_creator();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS set_updated_at ON public.creators;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

