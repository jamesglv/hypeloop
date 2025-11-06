-- Migration: Replace profiles table with creators table
-- This script will:
-- 1. Drop the old profiles table and related objects
-- 2. Create the new creators table with the same structure

-- Step 1: Drop existing triggers and functions related to profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS set_updated_at ON public.profiles;

DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.handle_new_creator();

-- Step 2: Drop the old profiles table (this will also drop indexes and policies)
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Step 3: Create the new creators table
CREATE TABLE IF NOT EXISTS public.creators (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  display_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  bio TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Step 4: Create index on username for faster lookups
CREATE INDEX IF NOT EXISTS creators_username_idx ON public.creators(username);

-- Step 5: Enable Row Level Security
ALTER TABLE public.creators ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies
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

-- Step 7: Create function to automatically create creator profile when user signs up
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

-- Step 8: Create trigger to automatically create creator profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_creator();

-- Step 9: Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 10: Create trigger to automatically update updated_at
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.creators
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

