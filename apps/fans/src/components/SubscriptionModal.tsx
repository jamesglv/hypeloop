import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';
import type { Creator } from './Home';

interface SubscriptionModalProps {
  creator: Creator;
  onClose: () => void;
  onSubscribe: () => void;
}

export function SubscriptionModal({ creator, onClose, onSubscribe }: SubscriptionModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const benefits = [
    'Unlimited chat access with AI trained by creator',
    'Early access to new content & announcements',
    'Exclusive tips and insights',
    'Priority responses and support',
  ];

  const handleSubscribe = async () => {
    if (!user) {
      setError('You must be logged in to subscribe');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create subscription
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .insert({
          fan_id: user.id,
          creator_id: creator.id,
          tier: 'basic',
          price_per_month: creator.price,
          currency: 'USD',
          status: 'active',
        })
        .select()
        .single();

      if (subscriptionError) {
        // If subscription already exists, that's okay
        if (subscriptionError.code === '23505') {
          // Unique constraint violation - subscription already exists
          console.log('Subscription already exists');
        } else {
          throw subscriptionError;
        }
      }

      // TODO: Integrate with Stripe for payment processing
      // For now, we'll just create the subscription record

      onSubscribe();
      onClose();
    } catch (err: any) {
      console.error('Error creating subscription:', err);
      setError(err.message || 'Failed to subscribe. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const creatorFirstName = creator.name.split(' ')[0];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-card rounded-t-[24px] sm:rounded-[24px] 
                     shadow-2xl overflow-hidden m-0 sm:m-4"
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-accent rounded-full 
                     transition-colors z-10"
          >
            <X className="w-6 h-6 text-muted-foreground" />
          </button>

          {/* Content */}
          <div className="p-8">
            {/* Creator Info */}
            <div className="flex items-center gap-4 mb-6">
              <img
                src={creator.avatar}
                alt={creator.name}
                className="w-16 h-16 rounded-full object-cover"
              />
              <div>
                <div className="text-foreground font-medium">{creator.name}</div>
                <div className="text-muted-foreground text-sm">@{creator.username}</div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            {/* Title */}
            <h2 className="text-foreground mb-2 text-xl font-medium">
              Subscribe to {creatorFirstName}'s Brain
            </h2>

            {/* Price */}
            <div className="flex items-baseline gap-2 mb-6">
              <span className="text-foreground text-2xl font-medium">${creator.price.toFixed(2)}</span>
              <span className="text-muted-foreground">per month</span>
            </div>

            {/* Benefits */}
            <div className="space-y-3 mb-8">
              {benefits.map((benefit, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex items-start gap-3"
                >
                  <div
                    style={{ backgroundColor: creator.brandColor }}
                    className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-foreground text-sm">{benefit}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubscribe}
              disabled={loading}
              style={{ backgroundColor: creator.brandColor }}
              className="w-full py-4 rounded-[14px] text-white transition-opacity 
                       hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Subscribing...' : `Start Chat $${creator.price.toFixed(2)}/mo`}
            </motion.button>

            {/* Fine Print */}
            <div className="text-muted-foreground text-center mt-4 text-sm">
              Cancel anytime. Billed monthly.
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

