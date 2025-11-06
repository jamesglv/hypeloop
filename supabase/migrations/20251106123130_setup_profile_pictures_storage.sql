-- ============================================================================
-- Profile Pictures Storage Bucket Setup
-- ============================================================================
-- This migration creates a PUBLIC storage bucket for profile pictures.
-- 
-- SECURITY NOTE: This bucket is intentionally public so profile pictures
-- can be displayed without authentication. However, RLS policies ensure:
-- 1. Only authenticated users can upload/update/delete files
-- 2. Users can only modify files in their own folder ({user-id}/)
-- 3. File size and type restrictions are enforced
--
-- This is safe because:
-- - Profile pictures are meant to be publicly visible
-- - Users cannot access/modify other users' files
-- - Only image files are allowed
-- ============================================================================

-- Create storage bucket for profile pictures
-- NOTE: This creates a PUBLIC bucket (intentional for profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-pictures',
  'profile-pictures',
  true, -- Public bucket so images can be accessed without auth (INTENTIONAL)
  5242880, -- 5MB file size limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own profile pictures" ON storage.objects;
DROP POLICY IF EXISTS "Profile pictures are publicly accessible" ON storage.objects;

-- Policy: Allow authenticated users to upload their own profile pictures
-- Files are stored in format: {user-id}/{filename}
-- Check that the file path starts with the user's ID
CREATE POLICY "Users can upload their own profile pictures"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  name LIKE auth.uid()::text || '/%'
);

-- Policy: Allow authenticated users to update their own profile pictures
CREATE POLICY "Users can update their own profile pictures"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  name LIKE auth.uid()::text || '/%'
)
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  name LIKE auth.uid()::text || '/%'
);

-- Policy: Allow authenticated users to delete their own profile pictures
CREATE POLICY "Users can delete their own profile pictures"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  name LIKE auth.uid()::text || '/%'
);

-- Policy: Allow public read access to profile pictures
-- NOTE: This is intentional - profile pictures should be publicly viewable
-- Users can still only upload/update/delete their own files via other policies
CREATE POLICY "Profile pictures are publicly accessible"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-pictures');

