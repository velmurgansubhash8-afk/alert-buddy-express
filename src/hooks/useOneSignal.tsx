import { useEffect, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: OneSignalType) => void>;
    OneSignal?: OneSignalType;
  }
}

interface OneSignalType {
  init: (options: OneSignalInitOptions) => Promise<void>;
  User: {
    PushSubscription: {
      id: string | null | undefined;
      optIn: () => Promise<void>;
      optOut: () => Promise<void>;
      addEventListener: (event: string, callback: (isSubscribed: boolean) => void) => void;
      removeEventListener: (event: string, callback: (isSubscribed: boolean) => void) => void;
    };
  };
  Notifications: {
    permission: boolean;
    requestPermission: () => Promise<void>;
    addEventListener: (event: string, callback: (event: NotificationEvent) => void) => void;
    removeEventListener: (event: string, callback: (event: NotificationEvent) => void) => void;
  };
  login: (externalId: string) => Promise<void>;
  logout: () => Promise<void>;
}

interface OneSignalInitOptions {
  appId: string;
  safari_web_id?: string;
  allowLocalhostAsSecureOrigin?: boolean;
  notifyButton?: {
    enable: boolean;
  };
  welcomeNotification?: {
    disable: boolean;
  };
}

interface NotificationEvent {
  notification: {
    title: string;
    body: string;
    data?: Record<string, string>;
  };
}

const ONESIGNAL_APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID || '';

export function useOneSignal() {
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const saveSubscription = useCallback(async (playerId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('onesignal_subscriptions')
        .upsert({
          user_id: user.id,
          player_id: playerId,
          platform: 'web'
        }, {
          onConflict: 'user_id,player_id'
        });

      if (error) {
        console.error('Error saving OneSignal subscription:', error);
      } else {
        console.log('OneSignal subscription saved successfully');
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
    } catch (err) {
      console.error('Error removing OneSignal subscription:', err);
    }
  }, [user]);

  const initializeOneSignal = useCallback(async () => {
    if (!ONESIGNAL_APP_ID || typeof window === 'undefined') {
      console.log('OneSignal App ID not configured');
      return;
    }

    // Load OneSignal SDK
    if (!document.getElementById('onesignal-sdk')) {
      const script = document.createElement('script');
      script.id = 'onesignal-sdk';
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.defer = true;
      document.head.appendChild(script);
    }

    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        await OneSignal.init({
          appId: ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: {
            enable: true,
          },
          welcomeNotification: {
            disable: true,
          },
        });

        setIsInitialized(true);
        console.log('OneSignal initialized');

        // Check current subscription status
        const playerId = OneSignal.User.PushSubscription.id;
        if (playerId) {
          setIsSubscribed(true);
          if (user) {
            await saveSubscription(playerId);
            await OneSignal.login(user.id);
          }
        }

        // Listen for subscription changes
        OneSignal.User.PushSubscription.addEventListener('change', async (subscribed: boolean) => {
          setIsSubscribed(subscribed);
          const newPlayerId = OneSignal.User.PushSubscription.id;
          
          if (subscribed && newPlayerId && user) {
            await saveSubscription(newPlayerId);
          } else if (!subscribed) {
            await removeSubscription();
          }
        });

        // Listen for notification clicks
        OneSignal.Notifications.addEventListener('click', (event: NotificationEvent) => {
          console.log('Notification clicked:', event);
          if (event.notification.data?.mapsLink) {
            window.open(event.notification.data.mapsLink, '_blank');
          }
        });

        // Show foreground notifications
        OneSignal.Notifications.addEventListener('foregroundWillDisplay', (event: NotificationEvent) => {
          console.log('Foreground notification:', event);
          toast.error(event.notification.title || 'Emergency Alert', {
            description: event.notification.body,
            duration: 10000,
            action: event.notification.data?.mapsLink ? {
              label: 'View Location',
              onClick: () => window.open(event.notification.data?.mapsLink, '_blank')
            } : undefined
          });
        });

      } catch (error) {
        console.error('Error initializing OneSignal:', error);
      }
    });
  }, [user, saveSubscription, removeSubscription]);

  const requestPermission = useCallback(async () => {
    if (!window.OneSignal) {
      console.log('OneSignal not initialized');
      return;
    }

    try {
      await window.OneSignal.Notifications.requestPermission();
      await window.OneSignal.User.PushSubscription.optIn();
      
      const playerId = window.OneSignal.User.PushSubscription.id;
      if (playerId && user) {
        await saveSubscription(playerId);
        setIsSubscribed(true);
        toast.success('Push notifications enabled!');
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to enable push notifications');
    }
  }, [user, saveSubscription]);

  const unsubscribe = useCallback(async () => {
    if (!window.OneSignal) return;

    try {
      await window.OneSignal.User.PushSubscription.optOut();
      await removeSubscription();
      setIsSubscribed(false);
      toast.success('Push notifications disabled');
    } catch (error) {
      console.error('Error unsubscribing:', error);
    }
  }, [removeSubscription]);

  useEffect(() => {
    if (user && !isInitialized) {
      initializeOneSignal();
    }

    return () => {
      if (window.OneSignal) {
        window.OneSignal.logout();
      }
    };
  }, [user, isInitialized, initializeOneSignal]);

  return {
    isSubscribed,
    isInitialized,
    requestPermission,
    unsubscribe
  };
}
