import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushNotificationRequest {
  alertId: string;
  senderName: string;
  emergencyType: string;
  latitude: number;
  longitude: number;
  excludeUserId: string;
  targetRoles?: string[];
  radiusKm?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const fcmServerKey = Deno.env.get('FCM_SERVER_KEY');
    if (!fcmServerKey) {
      console.warn('FCM_SERVER_KEY not configured - notifications will be skipped');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      alertId, 
      senderName, 
      emergencyType, 
      latitude, 
      longitude, 
      excludeUserId,
      targetRoles = [],
      radiusKm = 5.0 
    }: PushNotificationRequest = await req.json();

    console.log(`Processing push notification for alert ${alertId}`);
    console.log(`Location: ${latitude}, ${longitude}, Radius: ${radiusKm}km`);
    console.log(`Target roles: ${targetRoles.length > 0 ? targetRoles.join(', ') : 'all users'}`);

    let allNearbyUsers: { user_id: string; name: string; distance_km: number }[] = [];

    if (targetRoles.length === 0) {
      // No specific roles - get all nearby users
      const { data: nearbyUsers, error: nearbyError } = await supabase
        .rpc('get_nearby_users', {
          user_lat: latitude,
          user_lon: longitude,
          radius_km: radiusKm,
          exclude_user_id: excludeUserId
        });

      if (nearbyError) {
        console.error('Error getting nearby users:', nearbyError);
        throw nearbyError;
      }

      allNearbyUsers = nearbyUsers || [];
    } else {
      // Get users by specific roles
      for (const role of targetRoles) {
        const { data: roleUsers, error: roleError } = await supabase
          .rpc('get_users_by_role_nearby', {
            user_lat: latitude,
            user_lon: longitude,
            radius_km: radiusKm,
            target_role: role,
            exclude_user_id: excludeUserId
          });

        if (roleError) {
          console.error(`Error getting ${role} users:`, roleError);
          continue;
        }

        if (roleUsers) {
          // Add unique users only
          for (const user of roleUsers) {
            if (!allNearbyUsers.find(u => u.user_id === user.user_id)) {
              allNearbyUsers.push(user);
            }
          }
        }
      }
    }

    console.log(`Found ${allNearbyUsers.length} nearby users/responders`);

    if (allNearbyUsers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0, message: 'No nearby users found', nearbyUsersCount: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get FCM tokens for nearby users
    const nearbyUserIds = allNearbyUsers.map(u => u.user_id);
    const { data: tokens, error: tokensError } = await supabase
      .from('fcm_tokens')
      .select('token, user_id')
      .in('user_id', nearbyUserIds);

    if (tokensError) {
      console.error('Error getting FCM tokens:', tokensError);
      throw tokensError;
    }

    console.log(`Found ${tokens?.length || 0} FCM tokens`);

    if (!tokens || tokens.length === 0 || !fcmServerKey) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          notificationsSent: 0, 
          message: fcmServerKey ? 'No FCM tokens found for nearby users' : 'FCM not configured',
          nearbyUsersCount: allNearbyUsers.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get emoji for emergency type
    const typeEmoji = 
      emergencyType === 'fire' ? '🔥' :
      emergencyType === 'medical' ? '🏥' :
      emergencyType === 'accident' ? '🚗' :
      emergencyType === 'help' ? '🆘' : '🚨';

    // Send notifications to all tokens
    const notificationPromises = tokens.map(async ({ token }) => {
      const mapsLink = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
      
      const notification = {
        to: token,
        notification: {
          title: `${typeEmoji} ${emergencyType.toUpperCase()} ALERT`,
          body: `${senderName} needs help nearby!`,
          click_action: mapsLink,
          icon: '/favicon.ico',
          sound: 'default',
          priority: 'high'
        },
        data: {
          alertId,
          senderName,
          emergencyType,
          latitude: latitude.toString(),
          longitude: longitude.toString(),
          mapsLink,
          type: 'emergency_alert'
        },
        priority: 'high',
        content_available: true
      };

      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${fcmServerKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(notification),
      });

      const result = await response.json();
      console.log(`FCM response for token ${token.substring(0, 20)}...:`, result);
      return result;
    });

    const results = await Promise.allSettled(notificationPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    console.log(`Notifications sent: ${successful} successful, ${failed} failed`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: successful,
        failed,
        nearbyUsersCount: allNearbyUsers.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in send-push-notification function:', message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
