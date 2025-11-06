import { motion } from 'motion/react';
import { MessageCircle, Calendar } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';
import type { Creator } from './Home';

type SubscribedCreatorCardProps = {
  creator: Creator;
  onChatClick: (creator: Creator) => void;
};

export function SubscribedCreatorCard({ creator, onChatClick }: SubscribedCreatorCardProps) {
  const { user } = useAuth();
  const [subscribedSince, setSubscribedSince] = useState<string>('');
  const [lastActive, setLastActive] = useState<string>('');

  useEffect(() => {
    if (!user) return;

    const fetchSubscriptionData = async () => {
      // Fetch subscription date
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('created_at')
        .eq('fan_id', user.id)
        .eq('creator_id', creator.id)
        .eq('status', 'active')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (subscription?.created_at) {
        const date = new Date(subscription.created_at);
        setSubscribedSince(date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }));
      }

      // Fetch last message time
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('created_at')
        .eq('fan_id', user.id)
        .eq('creator_id', creator.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastMessage?.created_at) {
        const date = new Date(lastMessage.created_at);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffHours < 1) {
          setLastActive('Just now');
        } else if (diffHours < 24) {
          setLastActive(`${diffHours}h ago`);
        } else if (diffDays === 1) {
          setLastActive('1 day ago');
        } else {
          setLastActive(`${diffDays} days ago`);
        }
      }
    };

    fetchSubscriptionData();
  }, [user, creator.id]);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-card rounded-[16px] p-5 border border-border shadow-sm hover:shadow-md 
                 transition-shadow"
    >
      <div className="flex items-start gap-4 mb-4">
        <div className="relative">
          <img
            src={creator.avatar}
            alt={creator.name}
            className="w-14 h-14 rounded-full object-cover flex-shrink-0"
          />
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white"></div>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-foreground mb-0.5">{creator.name}</div>
          <div className="text-muted-foreground">@{creator.username}</div>
        </div>
      </div>

      <p className="text-foreground mb-4 line-clamp-2">
        {creator.tagline}
      </p>

      <div className="flex items-center gap-4 mb-4 text-muted-foreground">
        {subscribedSince && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" />
            <span>Since {subscribedSince}</span>
          </div>
        )}
        {lastActive && (
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" />
            <span>{lastActive}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ backgroundColor: creator.brandColor }}
          className="flex-1 px-4 py-2.5 rounded-[12px] text-white transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
          onClick={() => onChatClick(creator)}
        >
          <MessageCircle className="w-4 h-4" />
          <span>Open Chat</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="px-4 py-2.5 rounded-[12px] border border-border text-foreground hover:bg-accent transition-colors"
        >
          Manage
        </motion.button>
      </div>

      <div className="mt-3 pt-3 border-t border-border">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Subscription</span>
          <span className="text-foreground">${creator.price.toFixed(2)}/mo</span>
        </div>
      </div>
    </motion.div>
  );
}

