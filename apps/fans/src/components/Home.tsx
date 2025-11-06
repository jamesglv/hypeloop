import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';
import { CreatorCard } from './CreatorCard';
import { SubscribedCreatorCard } from './SubscribedCreatorCard';
import { ProfilePage } from './ProfilePage';

export interface Creator {
  id: string;
  name: string;
  username: string;
  tagline: string;
  price: number;
  category: string;
  avatar: string;
  brandColor: string;
}

interface HomeProps {
  onChatClick: (creator: Creator) => void;
  currentNav: 'home' | 'subscriptions' | 'profile';
}

export function Home({ onChatClick, currentNav }: HomeProps) {
  const { user } = useAuth();
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>(['All']);

  useEffect(() => {
    if (currentNav === 'subscriptions') {
      fetchSubscribedCreators();
    } else {
      fetchCreators();
    }
  }, [currentNav, user]);

  const fetchCreators = async () => {
    try {
      setLoading(true);
      // Fetch creators with their profiles
      const { data: creatorsData, error: creatorsError } = await supabase
        .from('creators')
        .select('id, display_name, username, bio');

      if (creatorsError) {
        console.error('Error fetching creators:', creatorsError);
        return;
      }

      // Fetch creator profiles for additional data
      const { data: profilesData, error: profilesError } = await supabase
        .from('creator_profiles')
        .select('id, niche, profile_picture_url');

      if (profilesError) {
        console.error('Error fetching creator profiles:', profilesError);
      }

      // Fetch subscriptions to get pricing (if available)
      // For now, we'll use a default price structure
      const creatorsWithProfiles = (creatorsData || []).map((creator) => {
        const profile = profilesData?.find((p) => p.id === creator.id);
        const niche = profile?.niche?.[0] || 'General';
        const avatar = profile?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.display_name)}&background=random`;
        
        // Generate a brand color based on the creator ID for consistency
        const colors = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#FBBF24', '#FB7185', '#34D399'];
        const colorIndex = parseInt(creator.id.slice(0, 2), 16) % colors.length;
        const brandColor = colors[colorIndex];

        return {
          id: creator.id,
          name: creator.display_name || 'Creator',
          username: creator.username || 'creator',
          tagline: creator.bio || 'Connect with this creator',
          price: 4.99, // Default price - you can fetch from subscription tiers later
          category: niche,
          avatar,
          brandColor,
        };
      });

      setCreators(creatorsWithProfiles);
      
      // Extract unique categories
      const uniqueCategories = Array.from(new Set(creatorsWithProfiles.map(c => c.category)));
      setCategories(['All', ...uniqueCategories]);
    } catch (error) {
      console.error('Error fetching creators:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter creators based on search and category
  const filteredCreators = creators.filter((creator) => {
    const matchesSearch = 
      creator.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      creator.tagline.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'All' || creator.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const fetchSubscribedCreators = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // Fetch subscribed creators
      const { data: subscriptions, error: subError } = await supabase
        .from('subscriptions')
        .select('creator_id, price_per_month')
        .eq('fan_id', user.id)
        .eq('status', 'active');

      if (subError) {
        console.error('Error fetching subscriptions:', subError);
        setLoading(false);
        return;
      }

      if (!subscriptions || subscriptions.length === 0) {
        setCreators([]);
        setLoading(false);
        return;
      }

      const creatorIds = subscriptions.map(sub => sub.creator_id);
      const priceMap = new Map(subscriptions.map(sub => [sub.creator_id, sub.price_per_month]));

      // Fetch creators with their profiles
      const { data: creatorsData, error: creatorsError } = await supabase
        .from('creators')
        .select('id, display_name, username, bio')
        .in('id', creatorIds);

      if (creatorsError) {
        console.error('Error fetching creators:', creatorsError);
        setLoading(false);
        return;
      }

      // Fetch creator profiles
      const { data: profilesData } = await supabase
        .from('creator_profiles')
        .select('id, niche, profile_picture_url')
        .in('id', creatorIds);

      const creatorsWithProfiles = (creatorsData || []).map((creator) => {
        const profile = profilesData?.find((p) => p.id === creator.id);
        const niche = profile?.niche?.[0] || 'General';
        const avatar = profile?.profile_picture_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(creator.display_name)}&background=random`;
        const price = priceMap.get(creator.id) || 4.99;
        
        const colors = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#FBBF24', '#FB7185', '#34D399'];
        const colorIndex = parseInt(creator.id.slice(0, 2), 16) % colors.length;
        const brandColor = colors[colorIndex];

        return {
          id: creator.id,
          name: creator.display_name || 'Creator',
          username: creator.username || 'creator',
          tagline: creator.bio || 'Connect with this creator',
          price: typeof price === 'number' ? price : parseFloat(price),
          category: niche,
          avatar,
          brandColor,
        };
      });

      setCreators(creatorsWithProfiles);
    } catch (error) {
      console.error('Error fetching subscribed creators:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPageTitle = () => {
    switch (currentNav) {
      case 'subscriptions':
        return 'Your Subscriptions';
      case 'profile':
        return 'Your Profile';
      default:
        return 'Discover Creators';
    }
  };

  const getPageContent = () => {
    if (currentNav === 'subscriptions') {
      if (loading) {
        return (
          <div className="flex items-center justify-center py-20 px-4">
            <p className="text-muted-foreground">Loading subscriptions...</p>
          </div>
        );
      }

      if (creators.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-20 px-4">
            <div className="text-muted-foreground mb-2">No active subscriptions yet</div>
            <div className="text-muted-foreground text-sm">Subscribe to creators to start chatting</div>
          </div>
        );
      }

      return (
        <div className="px-6 py-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {creators.map((creator) => (
              <SubscribedCreatorCard
                key={creator.id}
                creator={creator}
                onChatClick={onChatClick}
              />
            ))}
          </div>
        </div>
      );
    }
    
    if (currentNav === 'profile') {
      return <ProfilePage />;
    }

    // Home page content
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20 px-4">
          <p className="text-muted-foreground">Loading creators...</p>
        </div>
      );
    }

    return (
      <>
        {/* Search and Filters */}
        <div className="px-6 pt-6 pb-4">
          <div className="relative mb-4">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
            <input
              type="text"
              placeholder="Search creators…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-[14px] bg-card border border-border 
                       focus:outline-none focus:ring-2 focus:ring-ring transition-all text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm
                  ${selectedCategory === category
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card text-foreground border border-border hover:border-ring'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Creator Grid */}
        {filteredCreators.length === 0 ? (
          <div className="flex items-center justify-center py-20 px-4">
            <p className="text-muted-foreground">No creators found</p>
          </div>
        ) : (
          <div className="px-6 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCreators.map((creator) => (
              <CreatorCard
                key={creator.id}
                creator={creator}
                onChatClick={onChatClick}
              />
            ))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-10">
        <div className="px-6 py-5">
          <h2 className="text-foreground font-medium text-lg">{getPageTitle()}</h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1">
        {getPageContent()}
      </div>
    </div>
  );
}

