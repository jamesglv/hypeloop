import { useState, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';

export function ProfilePage() {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const loadProfile = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('fans')
          .select('display_name, profile_picture_url')
          .eq('id', user.id)
          .maybeSingle();

        if (fetchError && fetchError.code !== 'PGRST116') {
          console.error('Error loading profile:', fetchError);
        } else if (data) {
          // Split display_name into first and last name if it exists
          const displayName = data.display_name || '';
          const nameParts = displayName.trim().split(' ');
          if (nameParts.length > 1) {
            setFirstName(nameParts[0]);
            setLastName(nameParts.slice(1).join(' '));
          } else {
            setFirstName(displayName);
            setLastName('');
          }
          setProfileImage(data.profile_picture_url || null);
        }
      } catch (err) {
        console.error('Error loading profile:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [user]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfileImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setError('');
    setSuccess(false);

    try {
      // Combine firstName and lastName into display_name
      const displayName = `${firstName} ${lastName}`.trim();

      const { error: updateError } = await supabase
        .from('fans')
        .update({
          display_name: displayName || null,
          // TODO: Update profile_picture_url when storage is set up
          // profile_picture_url: profileImage
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setError(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-8">
      <div className="bg-card rounded-[16px] p-8 border border-border shadow-sm">
        <h3 className="text-foreground mb-6">Edit Profile</h3>

        {/* Profile Image Upload */}
        <div className="flex justify-center mb-8">
          <div className="relative">
            <div className="w-32 h-32 rounded-full overflow-hidden bg-muted border-2 border-border">
              {profileImage ? (
                <img
                  src={profileImage}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                  <Camera className="w-12 h-12" />
                </div>
              )}
            </div>
            <label
              htmlFor="profile-upload"
              className="absolute bottom-0 right-0 bg-[#7C3AED] text-white p-3 rounded-full 
                       cursor-pointer hover:bg-[#6D28D9] transition-colors shadow-lg"
            >
              <Camera className="w-5 h-5" />
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-700">Profile saved successfully!</p>
          </div>
        )}

        {/* Form Fields */}
        <div className="space-y-5">
          {/* First Name */}
          <div>
            <label htmlFor="firstName" className="block text-foreground mb-2">
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Enter your first name"
              className="w-full px-4 py-3 rounded-[12px] bg-input-background border border-border 
                       focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent 
                       transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Last Name */}
          <div>
            <label htmlFor="lastName" className="block text-foreground mb-2">
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Enter your last name"
              className="w-full px-4 py-3 rounded-[12px] bg-input-background border border-border 
                       focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent 
                       transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {/* Bio */}
          <div>
            <label htmlFor="bio" className="block text-foreground mb-2">
              Bio
            </label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell us about yourself..."
              rows={4}
              maxLength={500}
              className="w-full px-4 py-3 rounded-[12px] bg-input-background border border-border 
                       focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent 
                       transition-all resize-none text-foreground placeholder:text-muted-foreground"
            />
            <div className="text-muted-foreground mt-2">
              {bio.length} / 500 characters
            </div>
          </div>
        </div>

        {/* Save Button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleSave}
          disabled={saving}
          className="w-full mt-8 bg-[#7C3AED] text-white py-3 rounded-[12px] 
                   hover:bg-[#6D28D9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </motion.button>
      </div>
    </div>
  );
}

