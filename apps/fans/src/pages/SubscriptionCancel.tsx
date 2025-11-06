import { useNavigate } from 'react-router-dom';
import { XCircle } from 'lucide-react';

export default function SubscriptionCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-lg p-8 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-12 h-12 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-semibold text-foreground mb-2">
          Subscription Cancelled
        </h1>
        <p className="text-muted-foreground mb-6">
          Your subscription was not completed. No charges were made.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-2 bg-muted text-muted-foreground rounded-lg hover:opacity-90"
          >
            Go to Dashboard
          </button>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}

