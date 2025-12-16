import { useState, useEffect } from 'react';
import { Droplet, MapPin, MessageCircle, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ChatRoom } from './ChatRoom';
import { formatDistanceToNow } from 'date-fns';

interface BloodRequest {
  id: string;
  user_id: string;
  blood_group: string;
  message: string | null;
  maps_link: string;
  sender_name: string;
  created_at: string;
  status: string;
}

export function BloodRequestsFeed() {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);

  useEffect(() => {
    fetchRequests();

    const channel = supabase
      .channel('blood-requests-feed')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'blood_requests',
        },
        () => {
          fetchRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRequests = async () => {
    const { data, error } = await supabase
      .from('blood_requests')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRequests(data);
    }
    setLoading(false);
  };

  const handleChatClick = (requestId: string) => {
    setSelectedRequestId(requestId);
    setShowChat(true);
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="w-8 h-8 mx-auto mb-3 rounded-full bg-primary/20 animate-pulse" />
        <p>Loading blood requests...</p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Droplet className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No active blood requests</p>
        <p className="text-sm">Requests from nearby users will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-lg flex items-center gap-2">
        <Droplet className="w-5 h-5 text-red-500" />
        Active Blood Requests
      </h3>
      <div className="space-y-3">
        {requests.map((request) => (
          <div
            key={request.id}
            className="p-4 rounded-xl bg-red-500/10 border border-red-500/30"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
                  <span className="text-white font-bold text-sm">{request.blood_group}</span>
                </div>
                <div>
                  <p className="font-semibold">{request.sender_name}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
            {request.message && (
              <p className="text-sm text-muted-foreground mb-3">{request.message}</p>
            )}
            <div className="flex gap-2">
              <a
                href={request.maps_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full gap-2">
                  <MapPin className="w-4 h-4" />
                  View Location
                </Button>
              </a>
              <Button
                variant="default"
                size="sm"
                className="flex-1 gap-2 bg-red-600 hover:bg-red-700"
                onClick={() => handleChatClick(request.id)}
              >
                <MessageCircle className="w-4 h-4" />
                Respond
              </Button>
            </div>
          </div>
        ))}
      </div>

      {showChat && selectedRequestId && (
        <ChatRoom
          onClose={() => {
            setShowChat(false);
            setSelectedRequestId(null);
          }}
          bloodRequestId={selectedRequestId}
        />
      )}
    </div>
  );
}
