-- Create subscriptions table for fan subscriptions to creators
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fan_id UUID REFERENCES public.fans(id) ON DELETE CASCADE NOT NULL,
  creator_id UUID REFERENCES public.creators(id) ON DELETE CASCADE NOT NULL,
  
  -- Subscription details
  tier TEXT NOT NULL DEFAULT 'basic', -- 'basic', 'premium', etc.
  price_per_month DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  
  -- Subscription status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'expired', 'past_due'
  
  -- Billing information
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  
  -- Subscription metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
  
  -- Ensure one active subscription per fan-creator pair
  -- Note: This is enforced via a partial unique index below instead
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS subscriptions_fan_id_idx ON public.subscriptions(fan_id);
CREATE INDEX IF NOT EXISTS subscriptions_creator_id_idx ON public.subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_id_idx ON public.subscriptions(stripe_subscription_id);

-- Partial unique index to ensure one active subscription per fan-creator pair
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_subscription_idx 
  ON public.subscriptions(fan_id, creator_id) 
  WHERE status = 'active';

-- Enable Row Level Security
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Fans can view their own subscriptions
CREATE POLICY "Fans can view their own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = fan_id);

-- Policy: Creators can view subscriptions to them
CREATE POLICY "Creators can view subscriptions to them"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = creator_id);

-- Policy: Fans can create subscriptions
CREATE POLICY "Fans can create subscriptions"
  ON public.subscriptions
  FOR INSERT
  WITH CHECK (auth.uid() = fan_id);

-- Policy: Fans can update their own subscriptions
CREATE POLICY "Fans can update their own subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (auth.uid() = fan_id);

-- Policy: System can update subscriptions (for webhooks)
-- This would typically be handled via service role key, but we include it for completeness
CREATE POLICY "System can update subscriptions"
  ON public.subscriptions
  FOR UPDATE
  USING (true); -- Note: In production, restrict this to service role

-- Trigger to automatically update updated_at
CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

