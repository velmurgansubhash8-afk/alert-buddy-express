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

interface EmergencyAlert {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_unique_id: string;
  emergency_type: string;
  latitude: number;
  longitude: number;
  maps_link: string;
  target_roles: string[];
  created_at: string;
}

interface UserRole {
  id: string;
  user_id: string;
  role: 'user' | 'police' | 'fire_rescue' | 'medical';
}

export function useEmergencyAlerts() {
  const { user } = useAuth();
  const { getCurrentLocation, generateMapsLink } = useGeolocation();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [alerts, setAlerts] = useState<EmergencyAlert[]>([]);
  const [sending, setSending] = useState(false);

  // Fetch profile
  useEffect(() => {
    if (!user) return;

    const fetchProfile = async () => {
      const { data } = await supabase
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

  // Fetch user role
  useEffect(() => {
    if (!user) return;

    const fetchUserRole = async () => {
      const { data } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setUserRole(data as UserRole);
      }
    };

    fetchUserRole();
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
          
          // Check if this alert is relevant to the current user
          const targetRoles = newAlert.target_roles || [];
          const isRelevant = 
            targetRoles.length === 0 || // No target roles means it's for everyone
            (userRole && targetRoles.includes(userRole.role)) ||
            targetRoles.includes('user'); // Always show if users are targeted
          
          // Don't show own alerts as notifications
          if (newAlert.sender_unique_id !== profile?.unique_id && isRelevant) {
            setAlerts((prev) => [newAlert, ...prev]);
            
            const typeEmoji = 
              newAlert.emergency_type === 'fire' ? '🔥' :
              newAlert.emergency_type === 'medical' ? '🏥' :
              newAlert.emergency_type === 'accident' ? '🚗' :
              newAlert.emergency_type === 'help' ? '🆘' : '🚨';
            
            toast({
              title: `${typeEmoji} ${newAlert.emergency_type.toUpperCase()} Alert!`,
              description: `${newAlert.sender_name} needs help nearby!`,
              variant: 'destructive',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, userRole]);

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
    async (emergencyType: string, targetRoles: string[] = []): Promise<{ success: boolean; nearbyCount: number }> => {
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
          throw new Error('Could not get your location. Please enable location services.');
        }

        const mapsLink = generateMapsLink(location.latitude, location.longitude);

        // Create the alert
        const { data: alertData, error: alertError } = await supabase.from('emergency_alerts').insert({
          sender_id: user.id,
          sender_name: profile.name,
          sender_unique_id: profile.unique_id,
          emergency_type: emergencyType,
          latitude: location.latitude,
          longitude: location.longitude,
          maps_link: mapsLink,
          target_roles: targetRoles
        }).select().single();

        if (alertError) throw alertError;

        // Send push notifications to nearby users via edge function
        let nearbyCount = 0;
        try {
          const { data: pushResult, error: pushError } = await supabase.functions.invoke('send-push-notification', {
            body: {
              alertId: alertData.id,
              senderName: profile.name,
              emergencyType,
              latitude: location.latitude,
              longitude: location.longitude,
              excludeUserId: user.id,
              targetRoles,
              radiusKm: 5.0
            }
          });

          if (pushError) {
            console.error('Error sending push notifications:', pushError);
          } else {
            nearbyCount = pushResult?.nearbyUsersCount || 0;
            console.log('Push notification result:', pushResult);
          }
        } catch (pushErr) {
          console.error('Failed to invoke push notification function:', pushErr);
        }

        const typeEmoji = 
          emergencyType === 'fire' ? '🔥' :
          emergencyType === 'medical' ? '🏥' :
          emergencyType === 'accident' ? '🚗' :
          emergencyType === 'help' ? '🆘' : '🚨';

        toast({
          title: `${typeEmoji} ${emergencyType.toUpperCase()} Alert Sent!`,
          description: nearbyCount > 0 
            ? `Notified ${nearbyCount} nearby ${targetRoles.length > 0 ? 'responders/users' : 'users'}`
            : 'Alert broadcasted to the network',
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
    userRole,
    contacts,
    alerts,
    sending,
    sendEmergencyAlert,
    addContact,
    deleteContact,
    updateLocation,
  };
}
