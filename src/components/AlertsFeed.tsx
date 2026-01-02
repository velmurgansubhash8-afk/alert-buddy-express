import { MapPin, Clock, ExternalLink, History, Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Alert {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_unique_id: string;
  emergency_type: string;
  latitude: number;
  longitude: number;
  maps_link: string;
  created_at: string;
}

interface AlertsFeedProps {
  alerts: Alert[];
  currentUserId?: string;
}

const EMERGENCY_COLORS: Record<string, string> = {
  general: 'bg-primary/20 text-primary',
  medical: 'bg-pink-500/20 text-pink-400',
  fire: 'bg-orange-500/20 text-orange-400',
  security: 'bg-blue-500/20 text-blue-400',
  help: 'bg-blue-500/20 text-blue-400',
  accident: 'bg-yellow-500/20 text-yellow-400',
  sos: 'bg-red-500/20 text-red-400',
};

function AlertCard({ alert, isOwn }: { alert: Alert; isOwn?: boolean }) {
  return (
    <div
      className={`p-4 rounded-xl card-elevated border space-y-3 ${
        isOwn ? 'border-primary/50 bg-primary/5' : 'border-border/50'
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{alert.sender_name}</p>
            {isOwn && (
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">YOU</span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">ID: {alert.sender_unique_id}</p>
        </div>
        <span
          className={`status-badge ${EMERGENCY_COLORS[alert.emergency_type] || EMERGENCY_COLORS.general}`}
        >
          {alert.emergency_type.charAt(0).toUpperCase() + alert.emergency_type.slice(1)}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}</span>
        </div>
        <a
          href={alert.maps_link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-primary hover:underline"
        >
          <MapPin className="w-4 h-4" />
          <span>View Location</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export function AlertsFeed({ alerts, currentUserId }: AlertsFeedProps) {
  const myAlerts = alerts.filter(alert => alert.sender_id === currentUserId);
  const othersAlerts = alerts.filter(alert => alert.sender_id !== currentUserId);

  const EmptyState = ({ message, submessage }: { message: string; submessage: string }) => (
    <div className="text-center py-8 text-muted-foreground">
      <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
      <p>{message}</p>
      <p className="text-sm">{submessage}</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <Tabs defaultValue="nearby" className="w-full">
        <TabsList className="w-full grid grid-cols-2 mb-3">
          <TabsTrigger value="nearby" className="gap-1 text-xs">
            <Bell className="w-3 h-3" />
            Nearby Alerts
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-1 text-xs">
            <History className="w-3 h-3" />
            My History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="nearby" className="mt-0 space-y-3">
          {othersAlerts.length === 0 ? (
            <EmptyState message="No recent alerts in your area" submessage="Stay safe!" />
          ) : (
            othersAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-3">
          {myAlerts.length === 0 ? (
            <EmptyState message="No alerts sent yet" submessage="Your sent alerts will appear here" />
          ) : (
            myAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} isOwn />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
