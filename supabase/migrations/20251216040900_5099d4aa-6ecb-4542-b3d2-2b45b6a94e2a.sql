-- Create blood request table
CREATE TABLE public.blood_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_group TEXT NOT NULL,
  message TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  maps_link TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for blood requests
CREATE POLICY "Users can create their own blood requests"
ON public.blood_requests
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authenticated users can view all blood requests"
ON public.blood_requests
FOR SELECT
USING (true);

CREATE POLICY "Users can update their own blood requests"
ON public.blood_requests
FOR UPDATE
USING (auth.uid() = user_id);

-- Create chat messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  blood_request_id UUID REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_public BOOLEAN NOT NULL DEFAULT false,
  sender_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for chat messages
CREATE POLICY "Users can send messages"
ON public.chat_messages
FOR INSERT
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can view public messages"
ON public.chat_messages
FOR SELECT
USING (is_public = true OR auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;