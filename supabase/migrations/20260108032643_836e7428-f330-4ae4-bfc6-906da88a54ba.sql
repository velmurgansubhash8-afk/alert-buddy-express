-- Create OneSignal subscriptions table
CREATE TABLE public.onesignal_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  player_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'web',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, player_id)
);

-- Enable RLS
ALTER TABLE public.onesignal_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage their own subscriptions"
ON public.onesignal_subscriptions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Service role can read all subscriptions (for sending notifications)
CREATE POLICY "Service role can read all subscriptions"
ON public.onesignal_subscriptions
FOR SELECT
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_onesignal_subscriptions_updated_at
BEFORE UPDATE ON public.onesignal_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();