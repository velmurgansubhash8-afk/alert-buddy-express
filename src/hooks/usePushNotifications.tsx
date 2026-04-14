import { useEffect, useCallback, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);

  const saveSubscription = useCallback(async (pid: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('onesignal_subscriptions')
        .upsert({
          user_id: user.id,
          player_id: pid,
          platform: Capacitor.getPlatform()
        }, {
          onConflict: 'user_id,player_id'
        });

      if (error) {
        console.error('Error saving OneSignal subscription:', error);
      } else {
        console.log('OneSignal subscription saved successfully');
        setPlayerId(pid);
      }
    } catch (err) {
      console.error('Error saving OneSignal subscription:', err);
    }
  }, [user]);

  const removeSubscription = useCallback(async () => {
    if (!user) return;

    try {
      await supabase
        .from('onesignal_subscriptions')
        .delete()
        .eq('user_id', user.id);
      setPlayerId(null);
    } catch (err) {
      console.error('Error removing subscription:', err);
    }
  }, [user]);

  const registerPushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Native push notifications not available on web - use OneSignal web SDK instead');
      return;
    }

    if (!ONESIGNAL_APP_ID) {
      console.log('OneSignal App ID not configured');
      return;
    }

    try {
      // Dynamically import OneSignal native plugin
      const OneSignal = (await import('onesignal-cordova-plugin')).default;

      // Initialize OneSignal
      OneSignal.initialize(ONESIGNAL_APP_ID);

      // Set external user ID for targeting
      if (user) {
        OneSignal.login(user.id);
      }

      // Request notification permission
      const granted = await OneSignal.Notifications.requestPermission(true);
      setPermissionGranted(granted);

      if (granted) {
        // Get the player/subscription ID
        const subId = OneSignal.User.pushSubscription.getPushSubscriptionId();
        if (subId) {
          await saveSubscription(subId);
          toast.success('Push notifications enabled!');
        }

        // Listen for subscription changes
        OneSignal.User.pushSubscription.addEventListener('change', async (event: any) => {
          const newId = event?.current?.id;
          if (newId) {
            await saveSubscription(newId);
          }
        });

        // Handle foreground notifications
        OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: any) => {
          const notification = event.getNotification();
          toast.error(notification.title || 'Emergency Alert', {
            description: notification.body,
            duration: 10000,
          });
          // Allow notification to display in notification bar
          event.preventDefault();
          event.getNotification().display();
        });

        // Handle notification clicks
        OneSignal.Notifications.addEventListener('click', (event: any) => {
          const data = event?.notification?.additionalData;
          if (data?.mapsLink) {
            window.open(data.mapsLink, '_blank');
          }
        });
      }
    } catch (err) {
      console.error('Error registering push notifications:', err);
      toast.error('Failed to enable push notifications');
    }
  }, [user, saveSubscription]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    registerPushNotifications();

    return () => {
      // Cleanup handled by OneSignal SDK
    };
  }, [user, registerPushNotifications]);

  return {
    permissionGranted,
    playerId,
    registerPushNotifications,
    removeSubscription
  };
}
