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
    const oneSignalAppId = Deno.env.get('ONESIGNAL_APP_ID');
    const oneSignalApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');
    
    if (!oneSignalAppId || !oneSignalApiKey) {
      console.warn('OneSignal credentials not configured - notifications will be skipped');
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

    if (!oneSignalAppId || !oneSignalApiKey) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          notificationsSent: 0, 
          message: 'OneSignal not configured',
          nearbyUsersCount: allNearbyUsers.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get OneSignal player IDs for nearby users
    const nearbyUserIds = allNearbyUsers.map(u => u.user_id);
    const { data: playerIds, error: playerError } = await supabase
      .from('onesignal_subscriptions')
      .select('player_id, user_id')
      .in('user_id', nearbyUserIds);

    if (playerError) {
      console.error('Error getting OneSignal player IDs:', playerError);
      throw playerError;
    }

    console.log(`Found ${playerIds?.length || 0} OneSignal subscriptions`);

    if (!playerIds || playerIds.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          notificationsSent: 0, 
          message: 'No OneSignal subscriptions found for nearby users',
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

    const mapsLink = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

    // Send notification via OneSignal
    const notification = {
      app_id: oneSignalAppId,
      include_player_ids: playerIds.map(p => p.player_id),
      headings: { en: `${typeEmoji} ${emergencyType.toUpperCase()} ALERT` },
      contents: { en: `${senderName} needs help nearby!` },
      url: mapsLink,
      data: {
        alertId,
        senderName,
        emergencyType,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        mapsLink,
        type: 'emergency_alert'
      },
      priority: 10,
      ttl: 300,
      android_channel_id: 'emergency_alerts',
      ios_sound: 'default',
      android_sound: 'default'
    };

    console.log('Sending OneSignal notification:', JSON.stringify(notification, null, 2));

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${oneSignalApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(notification),
    });

    const result = await response.json();
    console.log('OneSignal response:', result);

    if (!response.ok) {
      console.error('OneSignal error:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.errors?.[0] || 'OneSignal notification failed',
          nearbyUsersCount: allNearbyUsers.length
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        notificationsSent: playerIds.length,
        onesignalId: result.id,
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
