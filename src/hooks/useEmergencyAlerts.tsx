import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useGeolocation } from './useGeolocation';
import { toast } from '@/hooks/use-toast';

interface Profile {
  name: string;
  unique_id: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

interface NearbyUser {
  user_id: string;
  name: string;
  unique_id: string;
  distance_km: number;
}

interface EmergencyAlert {
  id: string;
  sender_name: string;
  sender_unique_id: string;
  emergency_type: string;
  latitude: number;
  longitude: number;
  maps_link: string;
  created_at: string;
}

export function useEmergencyAlerts() {
  const { user } = useAuth();
  const { getCurrentLocation, generateMapsLink } = useGeolocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [sending, setSending] = useState(false);

  // Fetch profile
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, unique_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
      }
    };

    fetchProfile();
  }, [user]);

  // Fetch contacts
  useEffect(() => {
    if (!user) return;

    const fetchContacts = async () => {
      const { data } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (data) {
        setContacts(data);
      }
    };

    fetchContacts();
  }, [user]);

  // Subscribe to real-time alerts
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('emergency-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'emergency_alerts',
        },
        (payload) => {
          const newAlert = payload.new as EmergencyAlert;
          // Don't show own alerts as notifications
          if (newAlert.sender_unique_id !== profile?.unique_id) {
            setAlerts((prev) => [newAlert, ...prev]);
            toast({
              title: '🚨 Emergency Alert!',
              description: `${newAlert.sender_name} needs help! Type: ${newAlert.emergency_type}`,
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  // Update user location periodically
  const updateLocation = useCallback(async () => {
    if (!user) return;

    const location = await getCurrentLocation();
    if (!location) return;

    await supabase
      .from('user_locations')
      .upsert({
        user_id: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        updated_at: new Date().toISOString(),
      });
  }, [user, getCurrentLocation]);

  useEffect(() => {
    if (user) {
      updateLocation();
      // Update location every 5 minutes
      const interval = setInterval(updateLocation, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, updateLocation]);

  // Send emergency alert
  const sendEmergencyAlert = useCallback(
    async (emergencyType: string): Promise<{ success: boolean; nearbyCount: number }> => {
      if (!user || !profile) {
        toast({
          title: 'Error',
          description: 'You must be logged in to send alerts',
          variant: 'destructive',
        });
        return { success: false, nearbyCount: 0 };
      }

      setSending(true);

      try {
        // Get current location
        const location = await getCurrentLocation();
        if (!location) {
          throw new Error('Could not get your location');
        }

        const mapsLink = generateMapsLink(location.latitude, location.longitude);

        // Create the alert
        const { error: alertError } = await supabase.from('emergency_alerts').insert({
          sender_id: user.id,
          sender_name: profile.name,
          sender_unique_id: profile.unique_id,
          emergency_type: emergencyType,
          latitude: location.latitude,
          longitude: location.longitude,
          maps_link: mapsLink,
        });

        if (alertError) throw alertError;

        // Get nearby users
        const { data: nearbyUsers, error: nearbyError } = await supabase.rpc('get_nearby_users', {
          user_lat: location.latitude,
          user_lon: location.longitude,
          radius_km: 1.0,
          exclude_user_id: user.id,
        });

        if (nearbyError) {
          console.error('Error getting nearby users:', nearbyError);
        }

        const nearbyCount = (nearbyUsers as NearbyUser[] | null)?.length || 0;

        toast({
          title: 'Emergency Alert Sent!',
          description: `Alert sent to ${nearbyCount} nearby user${nearbyCount !== 1 ? 's' : ''} and your emergency contacts.`,
        });

        return { success: true, nearbyCount };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to send alert';
        toast({
          title: 'Error',
          description: message,
          variant: 'destructive',
        });
        return { success: false, nearbyCount: 0 };
      } finally {
        setSending(false);
      }
    },
    [user, profile, getCurrentLocation, generateMapsLink]
  );

  // Add emergency contact
  const addContact = async (name: string, phone: string) => {
    if (!user) return false;

    const { error } = await supabase.from('emergency_contacts').insert({
      user_id: user.id,
      name,
      phone,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to add contact',
        variant: 'destructive',
      });
      return false;
    }

    // Refresh contacts
    const { data } = await supabase
      .from('emergency_contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (data) {
      setContacts(data);
    }

    toast({
      title: 'Contact Added',
      description: `${name} has been added to your emergency contacts.`,
    });

    return true;
  };

  // Delete emergency contact
  const deleteContact = async (id: string) => {
    const { error } = await supabase.from('emergency_contacts').delete().eq('id', id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete contact',
        variant: 'destructive',
      });
      return false;
    }

    setContacts((prev) => prev.filter((c) => c.id !== id));
    return true;
  };

  return {
    profile,
    contacts,
    alerts,
    sending,
    sendEmergencyAlert,
    addContact,
    deleteContact,
    updateLocation,
  };
}
