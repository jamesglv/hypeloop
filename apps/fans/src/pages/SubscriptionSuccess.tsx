import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@hype-loop/shared';
import { useAuth } from '../contexts/AuthContext';

export default function SubscriptionSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const verifySubscription = async () => {
      const sessionId = searchParams.get('session_id');
      
      if (!sessionId) {
        setError('No session ID provided');
        setLoading(false);
        return;
      }

      // Wait a moment for webhook to process
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if subscription was created
      if (user) {
        const { data: subscriptions } = await supabase
          .from('subscriptions')
          .select('id, creator_id, status')
          .eq('fan_id', user.id)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (subscriptions && subscriptions.length > 0) {
          const creatorId = subscriptions[0].creator_id;
          setLoading(false);
          // Redirect to messages with creator selected after 2 seconds
          setTimeout(() => {
            navigate(`/dashboard/messages?creator=${creatorId}`);
          }, 2000);
        } else {
          // Subscription might still be processing, wait a bit more
          setTimeout(() => {
            setLoading(false);
          }, 3000);
        }
      } else {
        setLoading(false);
      }
    };

    verifySubscription();
  }, [searchParams, user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-8 text-center">
        {loading ? (
          <>
            <Loader2 className="w-16 h-16 text-primary animate-spin mx-auto mb-4" />
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Processing your subscription...
            </h1>
            <p className="text-muted-foreground">
              Please wait while we confirm your payment.
            </p>
          </>
        ) : error ? (
          <>
            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-destructive text-2xl">✕</span>
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Something went wrong
            </h1>
            <p className="text-muted-foreground mb-6">{error}</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground mb-2">
              Subscription Successful!
            </h1>
            <p className="text-muted-foreground mb-6">
              Your subscription has been activated. You can now start chatting with the creator.
            </p>
            <button
              onClick={async () => {
                // Get the most recent subscription to find creator_id
                if (user) {
                  const { data: subscriptions } = await supabase
                    .from('subscriptions')
                    .select('creator_id')
                    .eq('fan_id', user.id)
                    .eq('status', 'active')
                    .order('created_at', { ascending: false })
                    .limit(1);
                  
                  if (subscriptions && subscriptions.length > 0) {
                    navigate(`/dashboard/messages?creator=${subscriptions[0].creator_id}`);
                  } else {
                    navigate('/dashboard/messages');
                  }
                } else {
                  navigate('/dashboard/messages');
                }
              }}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
            >
              Start Chatting
            </button>
          </>
        )}
      </div>
    </div>
  );
}

