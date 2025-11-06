import { motion } from 'motion/react';
import type { Creator } from './Home';

type CreatorCardProps = {
  creator: Creator;
  onChatClick: (creator: Creator) => void;
};

export function CreatorCard({ creator, onChatClick }: CreatorCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-card rounded-[16px] p-5 border border-border shadow-sm hover:shadow-md 
                 transition-shadow cursor-pointer"
      onClick={() => onChatClick(creator)}
    >
      <div className="flex items-start gap-4 mb-4">
        <img
          src={creator.avatar}
          alt={creator.name}
          className="w-14 h-14 rounded-full object-cover flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="text-foreground mb-0.5">{creator.name}</div>
          <div className="text-muted-foreground">@{creator.username}</div>
        </div>
      </div>

      <p className="text-foreground mb-4 line-clamp-2">
        {creator.tagline}
      </p>

      <div className="flex items-center justify-between">
        <div className="text-foreground">${creator.price.toFixed(2)}/mo</div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{ backgroundColor: creator.brandColor }}
          className="px-5 py-2 rounded-[12px] text-white transition-opacity hover:opacity-90"
          onClick={(e) => {
            e.stopPropagation();
            onChatClick(creator);
          }}
        >
          Chat
        </motion.button>
      </div>
    </motion.div>
  );
}

