import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@hype-loop/shared';

export function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profilePictureUrl, setProfilePictureUrl] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  const [username, setUsername] = useState<string>('');

  // Generate avatar initials from name
  const getInitials = (name: string): string => {
    if (!name) return 'U';
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[words.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  // Fetch user profile picture and display name
  useEffect(() => {
    if (!user?.id) return;

    const fetchUserProfile = async () => {
      try {
        // Fetch profile picture from creator_profiles
        const { data: profileData } = await supabase
          .from('creator_profiles')
          .select('profile_picture_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profileData?.profile_picture_url) {
          setProfilePictureUrl(profileData.profile_picture_url);
        }

        // Fetch display name and username from creators
        const { data: creatorData } = await supabase
          .from('creators')
          .select('display_name, username')
          .eq('id', user.id)
          .maybeSingle();

        if (creatorData) {
          if (creatorData.display_name) {
            setDisplayName(creatorData.display_name);
          }
          if (creatorData.username) {
            setUsername(creatorData.username);
          }
        }
      } catch (error) {
        console.error('Error fetching user profile:', error);
      }
    };

    fetchUserProfile();
  }, [user]);

  return (
    <header className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
      <div className="flex items-center gap-4 flex-1">
        <h1 className="text-2xl font-semibold text-gray-900">Creator Dashboard</h1>
      </div>

      <button
        onClick={() => navigate('/settings')}
        className="flex items-center gap-3 hover:opacity-80 transition-opacity cursor-pointer"
      >
        {username && (
          <span className="text-sm font-medium text-gray-700">{username}</span>
        )}
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#7A5FFF] to-[#A689FF] flex items-center justify-center text-white ml-2 overflow-hidden">
          {profilePictureUrl ? (
            <img 
              src={profilePictureUrl} 
              alt={displayName || 'User'} 
              className="w-full h-full object-cover"
            />
          ) : (
            <span>{getInitials(displayName)}</span>
          )}
        </div>
      </button>
    </header>
  );
}

