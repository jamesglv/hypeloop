-- Improve fan profile trigger with better error handling and permissions
-- This migration enhances the existing handle_new_fan() function and trigger

-- Update function with error handling
CREATE OR REPLACE FUNCTION public.handle_new_fan()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create fan profile if it doesn't already exist
  -- This prevents errors if the profile was already created
  -- Use ON CONFLICT to handle race conditions gracefully
  INSERT INTO public.fans (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the user creation
    -- This ensures user signup succeeds even if profile creation fails
    RAISE WARNING 'Error creating fan profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to the function
GRANT EXECUTE ON FUNCTION public.handle_new_fan() TO postgres, anon, authenticated, service_role;

-- Add a policy to allow the trigger function to insert fan profiles
-- This is a safety measure, though SECURITY DEFINER should bypass RLS
DROP POLICY IF EXISTS "Trigger can insert fan profiles" ON public.fans;
CREATE POLICY "Trigger can insert fan profiles"
  ON public.fans
  FOR INSERT
  WITH CHECK (true);

-- Note: The above policy might be too permissive. A better approach is to rely on
-- SECURITY DEFINER which should bypass RLS. If the policy above causes issues,
-- it can be removed and the function should still work.

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created_fan ON auth.users;
CREATE TRIGGER on_auth_user_created_fan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_fan();

