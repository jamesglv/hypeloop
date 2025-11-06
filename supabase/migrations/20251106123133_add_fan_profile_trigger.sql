-- Function to automatically create fan profile when user signs up
-- This uses SECURITY DEFINER to bypass RLS and ensure the insert happens
-- after the user is fully committed to auth.users
CREATE OR REPLACE FUNCTION public.handle_new_fan()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create fan profile if it doesn't already exist
  -- This prevents errors if the profile was already created
  INSERT INTO public.fans (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', 'user_' || substr(NEW.id::text, 1, 8))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to automatically create fan profile on signup
-- Note: This will run AFTER the user is inserted into auth.users,
-- ensuring the foreign key constraint is satisfied
CREATE TRIGGER on_auth_user_created_fan
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_fan();

