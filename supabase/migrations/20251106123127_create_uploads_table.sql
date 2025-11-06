-- Create uploads table for optional file uploads (CSVs, transcripts, DMs)
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
  
  -- File information
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'csv', 'transcript', 'dm', 'image', etc.
  file_size BIGINT, -- Size in bytes
  file_url TEXT NOT NULL, -- URL to the file in storage
  storage_bucket TEXT DEFAULT 'uploads',
  
  -- Upload metadata
  mime_type TEXT,
  description TEXT,
  
  -- Processing status (for AI processing)
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  processed_at TIMESTAMP WITH TIME ZONE,
  processing_error TEXT,
  
  -- Extracted content (for transcripts, DMs, etc.)
  extracted_content JSONB DEFAULT '{}'::jsonb,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS uploads_creator_id_idx ON public.uploads(creator_id);
CREATE INDEX IF NOT EXISTS uploads_file_type_idx ON public.uploads(file_type);
CREATE INDEX IF NOT EXISTS uploads_processing_status_idx ON public.uploads(processing_status);

-- Enable Row Level Security
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- Policy: Creators can view their own uploads
CREATE POLICY "Creators can view their own uploads"
  ON public.uploads
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Policy: Creators can insert their own uploads
CREATE POLICY "Creators can insert their own uploads"
  ON public.uploads
  FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

-- Policy: Creators can update their own uploads
CREATE POLICY "Creators can update their own uploads"
  ON public.uploads
  FOR UPDATE
  USING (auth.uid() = creator_id);

-- Policy: Creators can delete their own uploads
CREATE POLICY "Creators can delete their own uploads"
  ON public.uploads
  FOR DELETE
  USING (auth.uid() = creator_id);

-- Trigger to automatically update updated_at
CREATE TRIGGER set_uploads_updated_at
  BEFORE UPDATE ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

