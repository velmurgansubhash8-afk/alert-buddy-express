-- Fix security issue: Remove overly permissive location viewing policy
-- Users should only access their own location, and use get_nearby_users function for proximity

-- Drop the insecure policy
DROP POLICY IF EXISTS "Authenticated users can view all locations for proximity" ON public.user_locations;

-- Create a secure policy - users can only view their own location
CREATE POLICY "Users can view their own location" 
ON public.user_locations 
FOR SELECT 
USING (auth.uid() = user_id);

-- The get_nearby_users function is already SECURITY DEFINER, so it can access all locations
-- This is the secure way to find nearby users without exposing all location data