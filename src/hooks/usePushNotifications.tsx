import { useEffect, useCallback, useState } from 'react';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export function usePushNotifications() {
  const { user } = useAuth();
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [fcmToken, setFcmToken] = useState<string | null>(null);

  const saveFcmToken = useCallback(async (token: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('fcm_tokens')
        .upsert({
          user_id: user.id,
          token,
          device_type: Capacitor.getPlatform()
        }, {
          onConflict: 'user_id,token'
        });

      if (error) {
        console.error('Error saving FCM token:', error);
      } else {
        console.log('FCM token saved successfully');
        setFcmToken(token);
      }
    } catch (err) {
      console.error('Error saving FCM token:', err);
    }
  }, [user]);

  const removeFcmToken = useCallback(async () => {
    if (!user || !fcmToken) return;

    try {
      await supabase
        .from('fcm_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', fcmToken);
      
      setFcmToken(null);
    } catch (err) {
      console.error('Error removing FCM token:', err);
    }
  }, [user, fcmToken]);

  const registerPushNotifications = useCallback(async () => {
    if (!Capacitor.isNativePlatform()) {
      console.log('Push notifications not available on web');
      return;
    }

    try {
      // Check current permission status
      let permStatus = await PushNotifications.checkPermissions();

      if (permStatus.receive === 'prompt') {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive !== 'granted') {
        console.log('Push notification permission denied');
        return;
      }

      setPermissionGranted(true);

      // Register with FCM
      await PushNotifications.register();

    } catch (err) {
      console.error('Error registering push notifications:', err);
    }
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !user) return;

    // Listen for registration success
    const registrationListener = PushNotifications.addListener('registration', (token: Token) => {
      console.log('Push registration success, token:', token.value);
      saveFcmToken(token.value);
    });

    // Listen for registration errors
    const errorListener = PushNotifications.addListener('registrationError', (error) => {
      console.error('Push registration error:', error);
    });

    // Listen for incoming notifications when app is in foreground
    const notificationListener = PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      console.log('Push notification received:', notification);
      
      // Show toast for foreground notifications
      toast.error(notification.title || 'Emergency Alert', {
        description: notification.body,
        duration: 10000,
        action: notification.data?.mapsLink ? {
          label: 'View Location',
          onClick: () => window.open(notification.data.mapsLink, '_blank')
        } : undefined
      });
    });

    // Listen for notification taps
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      console.log('Push notification action performed:', action);
      
      // Open maps link if available
      if (action.notification.data?.mapsLink) {
        window.open(action.notification.data.mapsLink, '_blank');
      }
    });

    // Register for push notifications
    registerPushNotifications();

    return () => {
      registrationListener.then(l => l.remove());
      errorListener.then(l => l.remove());
      notificationListener.then(l => l.remove());
      actionListener.then(l => l.remove());
    };
  }, [user, saveFcmToken, registerPushNotifications]);

  return {
    permissionGranted,
    fcmToken,
    registerPushNotifications,
    removeFcmToken
  };
}
