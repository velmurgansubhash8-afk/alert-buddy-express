import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useGeolocation } from './useGeolocation';
import { toast } from 'sonner';

export interface BloodRequest {
  id: string;
  user_id: string;
  blood_group: string;
  message: string | null;
  latitude: number;
  longitude: number;
  maps_link: string;
  sender_name: string;
  status: string;
  created_at: string;
}

export function useBloodRequests() {
  const { user } = useAuth();
  const { getCurrentLocation, generateMapsLink } = useGeolocation();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [sending, setSending] = useState(false);

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('blood_requests')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
  }, []);

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('blood-requests')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'blood_requests'
      }, (payload) => {
        const newRequest = payload.new as BloodRequest;
        if (newRequest.user_id !== user?.id) {
          toast.info(`🩸 Blood Request: ${newRequest.blood_group} needed!`, {
            description: newRequest.message || 'Tap to view location',
            action: {
              label: 'View',
              onClick: () => window.open(newRequest.maps_link, '_blank')
            }
          });
        }
        setRequests(prev => [newRequest, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchRequests]);

  const sendBloodRequest = useCallback(async (bloodGroup: string, message: string) => {
    if (!user) return { success: false };

    setSending(true);
    try {
      const location = await getCurrentLocation();
      if (!location) {
        toast.error('Could not get your location');
        return { success: false };
      }

      const mapsLink = generateMapsLink(location.latitude, location.longitude);

      const { data: profile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .single();

      const { error } = await supabase.from('blood_requests').insert({
        user_id: user.id,
        blood_group: bloodGroup,
        message: message || null,
        latitude: location.latitude,
        longitude: location.longitude,
        maps_link: mapsLink,
        sender_name: profile?.name || 'Unknown'
      });

      if (error) throw error;

      // Notify nearby users via edge function
      await supabase.functions.invoke('send-push-notification', {
        body: {
          latitude: location.latitude,
          longitude: location.longitude,
          title: `🩸 Blood Request: ${bloodGroup}`,
          body: message || `Someone nearby needs ${bloodGroup} blood!`,
          excludeUserId: user.id
        }
      });

      toast.success('Blood request sent to nearby users!');
      return { success: true };
    } catch (error) {
      console.error('Error sending blood request:', error);
      toast.error('Failed to send blood request');
      return { success: false };
    } finally {
      setSending(false);
    }
  }, [user, getCurrentLocation, generateMapsLink]);

  return {
    requests,
    sending,
    sendBloodRequest
  };
}
