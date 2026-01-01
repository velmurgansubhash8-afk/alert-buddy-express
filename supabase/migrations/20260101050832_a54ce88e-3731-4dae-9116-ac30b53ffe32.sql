
-- Create enum for user roles/departments
CREATE TYPE public.user_role AS ENUM ('user', 'police', 'fire_rescue', 'medical');

-- Create user_roles table for role-based access
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own role
CREATE POLICY "Users can view their own role"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Policy for users to insert their own role during signup
CREATE POLICY "Users can insert their own role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Service role can read all roles (for edge functions)
CREATE POLICY "Service role can read all roles"
ON public.user_roles
FOR SELECT
USING (true);

-- Create security definer function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role user_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to get users by role within radius
CREATE OR REPLACE FUNCTION public.get_users_by_role_nearby(
    user_lat double precision,
    user_lon double precision,
    radius_km double precision DEFAULT 5.0,
    target_role user_role DEFAULT NULL,
    exclude_user_id uuid DEFAULT NULL
)
RETURNS TABLE(user_id uuid, name text, unique_id text, role user_role, distance_km double precision)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ul.user_id,
    p.name,
    p.unique_id,
    ur.role,
    public.calculate_distance(user_lat, user_lon, ul.latitude, ul.longitude) as distance_km
  FROM public.user_locations ul
  JOIN public.profiles p ON ul.user_id = p.user_id
  JOIN public.user_roles ur ON ul.user_id = ur.user_id
  WHERE (exclude_user_id IS NULL OR ul.user_id != exclude_user_id)
    AND public.calculate_distance(user_lat, user_lon, ul.latitude, ul.longitude) <= radius_km
    AND (target_role IS NULL OR ur.role = target_role)
  ORDER BY distance_km;
END;
$$;

-- Add emergency_type categories to emergency_alerts if not exists
ALTER TABLE public.emergency_alerts 
ADD COLUMN IF NOT EXISTS target_roles text[] DEFAULT '{}';

-- Enable realtime for user_roles
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_roles;
