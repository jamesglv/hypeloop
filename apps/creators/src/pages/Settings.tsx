import { useState, useEffect } from 'react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Upload, Link as LinkIcon } from 'lucide-react';
import { Switch } from '../components/ui/switch';
import { Slider } from '../components/ui/slider';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile Settings
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [niche, setNiche] = useState<string[]>([]);
  const [nicheInput, setNicheInput] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');
  const [uploadingPicture, setUploadingPicture] = useState(false);
  
  // Chat Behavior Settings
  const [toneProfessionalCasual, setToneProfessionalCasual] = useState(65);
  const [humorLevel, setHumorLevel] = useState<'Off' | 'Light' | 'Bold'>('Light');
  const [emojiFrequency, setEmojiFrequency] = useState<'None' | 'Some' | 'Frequent'>('Some');
  const [defaultGreeting, setDefaultGreeting] = useState('');
  
  // Privacy & Access
  const [approveMessagesBeforeAI, setApproveMessagesBeforeAI] = useState(false);
  const [allowFansToSeeTrainingUpdates, setAllowFansToSeeTrainingUpdates] = useState(true);

  // Load settings from database
  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    const loadSettings = async () => {
      try {
        // Load from creators table
        const { data: creatorData, error: creatorError } = await supabase
          .from('creators')
          .select('display_name, bio')
          .eq('id', user.id)
          .maybeSingle(); // Use maybeSingle() to gracefully handle no rows

        if (creatorError && creatorError.code !== 'PGRST116') {
          console.error('Error loading creator data:', creatorError);
        }

        if (creatorData) {
          setDisplayName(creatorData.display_name || '');
          setBio(creatorData.bio || '');
        }

        // Load from creator_profiles table
        const { data: profileData, error: profileError } = await supabase
          .from('creator_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(); // Use maybeSingle() to gracefully handle no rows

        if (profileError && profileError.code !== 'PGRST116') {
          console.error('Error loading profile data:', profileError);
        }

        if (profileData) {
          // Profile Settings
          // Handle niche - it's a TEXT[] array in PostgreSQL
          if (profileData.niche) {
            setNiche(Array.isArray(profileData.niche) ? profileData.niche : []);
          } else {
            setNiche([]);
          }
          
          setProfilePictureUrl(profileData.profile_picture_url || '');
          
          // Chat Behavior Settings
          setDefaultGreeting(profileData.default_greeting || '');

          // Load tone settings - handle both Settings and TrainBrain fields
          if (profileData.tone_settings && typeof profileData.tone_settings === 'object') {
            const tone = profileData.tone_settings;
            // Settings uses professional_casual, TrainBrain uses formal_casual
            // Prefer professional_casual if it exists, otherwise use formal_casual
            setToneProfessionalCasual(
              tone.professional_casual ?? 
              tone.formal_casual ?? 
              65
            );
            
            // Load humor level (Settings-specific)
            if (tone.humor_level && ['Off', 'Light', 'Bold'].includes(tone.humor_level)) {
              setHumorLevel(tone.humor_level);
            }
            
            // Load emoji frequency (Settings-specific)
            if (tone.emoji_frequency && ['None', 'Some', 'Frequent'].includes(tone.emoji_frequency)) {
              setEmojiFrequency(tone.emoji_frequency);
            }
          }

          // Privacy & Access Settings
          setApproveMessagesBeforeAI(profileData.approve_messages_before_ai ?? false);
          setAllowFansToSeeTrainingUpdates(profileData.allow_fans_to_see_training_updates ?? true);
        } else {
          // Initialize with defaults if no profile exists
          console.log('No profile data found, using defaults');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user?.id]);

  // Save settings to database - using EXACT same pattern as TrainBrain
  const saveSettings = async () => {
    if (!user?.id || saving) return;

    setSaving(true);
    try {
      // Save to creators table first (same pattern as TrainBrain)
      const { data: existingCreator, error: creatorCheckError } = await supabase
        .from('creators')
        .select('id')
        .eq('id', user.id)
        .single();

      // If error is PGRST116 (no rows found), that's fine - we'll insert
      if (creatorCheckError && creatorCheckError.code !== 'PGRST116') {
        throw creatorCheckError;
      }

      if (existingCreator) {
        const { error: creatorError } = await supabase
          .from('creators')
          .update({
            display_name: displayName,
            bio: bio || null
          })
          .eq('id', user.id);
        if (creatorError) throw creatorError;
      } else {
        const { error: creatorError } = await supabase
          .from('creators')
          .insert({
            id: user.id,
            display_name: displayName,
            username: `user_${user.id.substring(0, 8)}`,
            bio: bio || null
          });
        if (creatorError) throw creatorError;
      }

      // Get existing tone_settings to merge (preserve TrainBrain settings)
      // Same pattern - use .single() and handle missing row in try/catch
      let existingToneSettings = {};
      try {
        const { data: existingProfile } = await supabase
          .from('creator_profiles')
          .select('tone_settings')
          .eq('id', user.id)
          .single();
        existingToneSettings = existingProfile?.tone_settings || {};
      } catch (err) {
        // Profile doesn't exist yet, use empty object
        existingToneSettings = {};
      }

      // Merge tone settings: preserve TrainBrain settings and update Settings-specific fields
      const toneSettings = {
        ...existingToneSettings,
        professional_casual: toneProfessionalCasual,
        humor_level: humorLevel,
        emoji_frequency: emojiFrequency
      };

      // Prepare niche array - filter out empty values
      const nicheArray = Array.isArray(niche) ? niche.filter(n => n && n.trim()) : [];
      const trimmedGreeting = defaultGreeting?.trim();
      
      // Prepare update data - only include fields we want to update
      const profileUpdateData: any = {
        niche: nicheArray,
        profile_picture_url: profilePictureUrl?.trim() || null,
        tone_settings: toneSettings,
        default_greeting: trimmedGreeting || null,
        approve_messages_before_ai: approveMessagesBeforeAI,
        allow_fans_to_see_training_updates: allowFansToSeeTrainingUpdates
      };

      console.log('About to save profile data:', profileUpdateData);
      console.log('User ID:', user.id);

      // Check if profile exists - EXACT same pattern as TrainBrain
      const { data: existing, error: existingError } = await supabase
        .from('creator_profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      console.log('Existing profile check:', { existing, existingError });

      // If error is PGRST116 (no rows found), that's fine - we'll insert
      // For any other error, throw it
      if (existingError && existingError.code !== 'PGRST116') {
        console.error('Error checking for existing profile:', existingError);
        throw existingError;
      }

      if (existing) {
        console.log('Updating existing profile with data:', profileUpdateData);
        // Update existing profile
        const { error, data: updateResult } = await supabase
          .from('creator_profiles')
          .update(profileUpdateData)
          .eq('id', user.id)
          .select();
        if (error) {
          console.error('Error updating profile:', error);
          throw error;
        }
        console.log('Profile updated successfully:', updateResult);
      } else {
        console.log('Creating new profile with data:', { id: user.id, ...profileUpdateData });
        // Create new profile
        const { error, data: insertResult } = await supabase
          .from('creator_profiles')
          .insert({
            id: user.id,
            ...profileUpdateData
          })
          .select();
        if (error) {
          console.error('Error creating profile:', error);
          throw error;
        }
        console.log('Profile created successfully:', insertResult);
      }

      // Reload settings from database to verify and refresh UI
      const { data: verifyData, error: verifyError } = await supabase
        .from('creator_profiles')
        .select('niche, default_greeting, tone_settings, approve_messages_before_ai, allow_fans_to_see_training_updates')
        .eq('id', user.id)
        .maybeSingle();

      if (!verifyError && verifyData) {
        console.log('Verification - Saved data from database:', {
          niche: verifyData.niche,
          nicheIsArray: Array.isArray(verifyData.niche),
          nicheLength: Array.isArray(verifyData.niche) ? verifyData.niche.length : 'N/A',
          default_greeting: verifyData.default_greeting,
          default_greetingLength: verifyData.default_greeting?.length || 0,
          tone_settings: verifyData.tone_settings,
          approve_messages_before_ai: verifyData.approve_messages_before_ai,
          allow_fans_to_see_training_updates: verifyData.allow_fans_to_see_training_updates
        });
        
        // Update local state to reflect what was actually saved
        if (Array.isArray(verifyData.niche)) {
          setNiche(verifyData.niche);
        } else {
          setNiche([]);
        }
        
        setDefaultGreeting(verifyData.default_greeting || '');
        setApproveMessagesBeforeAI(verifyData.approve_messages_before_ai ?? false);
        setAllowFansToSeeTrainingUpdates(verifyData.allow_fans_to_see_training_updates ?? true);
      } else if (verifyError) {
        console.warn('Could not verify save:', verifyError);
      }

      // Show success message
      alert('Settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      console.error('Error details:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint
      });
      alert(`Error saving settings: ${error?.message || 'Unknown error'}. Check console for details.`);
    } finally {
      setSaving(false);
    }
  };

  const handleNicheAdd = () => {
    if (nicheInput.trim() && !niche.includes(nicheInput.trim())) {
      setNiche([...niche, nicheInput.trim()]);
      setNicheInput('');
    }
  };

  const handleNicheRemove = (index: number) => {
    setNiche(niche.filter((_, i) => i !== index));
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    setUploadingPicture(true);

    try {
      // Create a unique file name
      // Store in user-specific folder: {user-id}/{filename}
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true // Allow overwriting existing files
        });

      if (uploadError) {
        // Check for specific error types
        if (uploadError.message.includes('Bucket not found')) {
          alert('Storage bucket not configured. Please run the migration to create the "profile-pictures" bucket.');
          setUploadingPicture(false);
          return;
        }
        
        if (uploadError.message.includes('row-level security') || uploadError.message.includes('policy')) {
          alert('Storage bucket RLS policies not configured. Please run the storage migration to set up policies.');
          setUploadingPicture(false);
          return;
        }
        
        // If file already exists, try update (shouldn't happen with upsert: true, but just in case)
        if (uploadError.message.includes('already exists')) {
          const { error: updateError } = await supabase.storage
            .from('profile-pictures')
            .update(filePath, file, {
              cacheControl: '3600'
            });

          if (updateError) {
            throw updateError;
          }
        } else {
          throw uploadError;
        }
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        // Delete old profile picture if it exists (only if it's different)
        if (profilePictureUrl && !profilePictureUrl.includes(filePath)) {
          try {
            // Extract the file path from the URL
            const urlParts = profilePictureUrl.split('/profile-pictures/');
            if (urlParts.length > 1) {
              const oldFilePath = urlParts[1].split('?')[0]; // Remove query params
              await supabase.storage
                .from('profile-pictures')
                .remove([oldFilePath]);
            }
          } catch (deleteError) {
            console.error('Error deleting old profile picture:', deleteError);
            // Continue even if deletion fails - old file will be overwritten anyway
          }
        }

        // Update state and save to database immediately
        setProfilePictureUrl(urlData.publicUrl);
        
        // Save to database
        const { data: existingProfileCheck } = await supabase
          .from('creator_profiles')
          .select('id')
          .eq('id', user.id)
          .single();

        const updateData = {
          profile_picture_url: urlData.publicUrl
        };

        if (existingProfileCheck) {
          await supabase
            .from('creator_profiles')
            .update(updateData)
            .eq('id', user.id);
        } else {
          await supabase
            .from('creator_profiles')
            .insert({
              id: user.id,
              ...updateData
            });
        }

      }
    } catch (error: any) {
      console.error('Error uploading profile picture:', error);
      alert('Error uploading profile picture: ' + (error.message || 'Unknown error'));
    } finally {
      setUploadingPicture(false);
      // Reset file input
      event.target.value = '';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1>Settings</h1>

      {/* Profile Settings */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h2 className="mb-4">Profile Settings</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Profile Picture</label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {profilePictureUrl ? (
                  <img 
                    src={profilePictureUrl} 
                    alt="Profile" 
                    className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] flex items-center justify-center text-white text-2xl border-2 border-gray-200">
                    {getInitials(displayName || 'CB')}
                  </div>
                )}
                {uploadingPicture && (
                  <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center">
                    <div className="text-white text-xs">Uploading...</div>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  id="profile-picture-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={uploadingPicture}
                />
                <label htmlFor="profile-picture-upload" className="cursor-pointer">
                  <Button 
                    variant="outline" 
                    className="rounded-xl cursor-pointer"
                    disabled={uploadingPicture}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      if (!uploadingPicture) {
                        document.getElementById('profile-picture-upload')?.click();
                      }
                    }}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingPicture ? 'Uploading...' : 'Upload New'}
                  </Button>
                </label>
                {profilePictureUrl && (
                  <Button
                    variant="outline"
                    className="rounded-xl text-sm text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={async () => {
                      if (!user?.id || !confirm('Are you sure you want to remove your profile picture?')) {
                        return;
                      }

                      try {
                        // Delete from storage
                        const urlParts = profilePictureUrl.split('/profile-pictures/');
                        if (urlParts.length > 1) {
                          const filePath = urlParts[1].split('?')[0]; // Remove query params
                          await supabase.storage
                            .from('profile-pictures')
                            .remove([filePath]);
                        }

                        // Update database
                        const { data: existingProfileCheck } = await supabase
                          .from('creator_profiles')
                          .select('id')
                          .eq('id', user.id)
                          .single();

                        if (existingProfileCheck) {
                          await supabase
                            .from('creator_profiles')
                            .update({ profile_picture_url: null })
                            .eq('id', user.id);
                        }

                        setProfilePictureUrl('');
                      } catch (error) {
                        console.error('Error removing profile picture:', error);
                        alert('Error removing profile picture');
                      }
                    }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Recommended: Square image, at least 400x400px. Max 5MB.
            </p>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF]"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Bio</label>
            <textarea
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell your fans about yourself..."
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF] resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Niche</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={nicheInput}
                onChange={(e) => setNicheInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleNicheAdd();
                  }
                }}
                placeholder="Add a niche (e.g., Content Creation)"
                className="flex-1 px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF]"
              />
              <Button 
                type="button"
                onClick={handleNicheAdd}
                variant="outline" 
                className="rounded-xl"
              >
                Add
              </Button>
            </div>
            {niche.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {niche.map((item, index) => (
                  <div
                    key={index}
                    className="px-3 py-1 bg-[#7A5FFF]/10 text-[#7A5FFF] rounded-lg text-sm flex items-center gap-2"
                  >
                    {item}
                    <button
                      onClick={() => handleNicheRemove(index)}
                      className="text-[#7A5FFF] hover:text-[#6B4FEF]"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Chat Behavior Settings */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h2 className="mb-4">Chat Behavior Settings</h2>
        <div className="space-y-6">
          <div>
            <label className="block text-sm text-gray-600 mb-3">Tone Slider</label>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">Professional</span>
              <Slider 
                value={[toneProfessionalCasual]} 
                onChange={(value: number[]) => setToneProfessionalCasual(value[0])}
                max={100} 
                className="flex-1" 
              />
              <span className="text-sm text-gray-600">Casual</span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-3">Humor Level</label>
            <div className="flex gap-3">
              {(['Off', 'Light', 'Bold'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setHumorLevel(level)}
                  className={`px-6 py-2 rounded-xl transition-colors ${
                    level === humorLevel
                      ? 'bg-[#7A5FFF] text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Emoji Use Frequency</label>
            <select 
              value={emojiFrequency}
              onChange={(e) => setEmojiFrequency(e.target.value as 'None' | 'Some' | 'Frequent')}
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF]"
            >
              <option>None</option>
              <option>Some</option>
              <option>Frequent</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Default Greeting</label>
            <input
              type="text"
              value={defaultGreeting}
              onChange={(e) => setDefaultGreeting(e.target.value)}
              placeholder="Hey! Great to connect with you 👋"
              className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF]"
            />
          </div>
        </div>
      </Card>

      {/* Privacy & Access */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h2 className="mb-4">Privacy & Access</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3">
            <div>
              <div className="text-sm mb-1">Approve messages before AI answers</div>
              <div className="text-sm text-gray-600">Review AI responses before they're sent to fans</div>
            </div>
            <Switch 
              checked={approveMessagesBeforeAI}
              onCheckedChange={setApproveMessagesBeforeAI}
            />
          </div>

          <div className="flex items-center justify-between py-3 border-t border-gray-100">
            <div>
              <div className="text-sm mb-1">Allow fans to see AI training updates</div>
              <div className="text-sm text-gray-600">Let subscribers know when you improve your AI</div>
            </div>
            <Switch 
              checked={allowFansToSeeTrainingUpdates}
              onCheckedChange={setAllowFansToSeeTrainingUpdates}
            />
          </div>
        </div>
      </Card>

      {/* Billing */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h2 className="mb-4">Billing</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-600 mb-2">Card on File</label>
            <div className="flex items-center gap-2 p-4 bg-[#F9F9F9] rounded-xl">
              <div className="w-8 h-6 bg-gray-800 rounded flex items-center justify-center text-white text-xs">
                ****
              </div>
              <span>•••• •••• •••• 4242</span>
              <Button variant="outline" className="ml-auto rounded-xl text-sm">
                Update
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-2">Payout Method</label>
            <select className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#7A5FFF]">
              <option>Bank Transfer</option>
              <option>PayPal</option>
              <option>Stripe</option>
            </select>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">Monthly Subscription Revenue</span>
              <span className="text-lg">$6,920</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Platform Fee (15%)</span>
              <span className="text-lg text-red-600">-$1,038</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Integrations */}
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h2 className="mb-4">Integrations</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 bg-[#F9F9F9] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#5865F2] flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm">Discord</div>
                <div className="text-xs text-gray-600">Sync messages and notifications</div>
              </div>
            </div>
            <Button variant="outline" className="rounded-xl">
              Connect
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#F9F9F9] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-black flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm">Notion</div>
                <div className="text-xs text-gray-600">Import knowledge from your workspace</div>
              </div>
            </div>
            <Button variant="outline" className="rounded-xl">
              Connect
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#F9F9F9] rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#FF0000] flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="text-sm">YouTube</div>
                <div className="text-xs text-gray-600">Learn from your video content</div>
              </div>
            </div>
            <Button className="bg-[#7A5FFF] hover:bg-[#6B4FEF] text-white rounded-xl">
              Connected
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex justify-end gap-3 pt-4">
        <Button 
          variant="outline" 
          className="rounded-xl"
          onClick={() => window.location.reload()}
        >
          Cancel
        </Button>
        <Button 
          className="bg-[#7A5FFF] hover:bg-[#6B4FEF] text-white rounded-xl"
          onClick={saveSettings}
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </div>
  );
}

