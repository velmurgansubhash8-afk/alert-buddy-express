import { MapPin, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Alert {
  id: string;
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
}

const EMERGENCY_COLORS: Record<string, string> = {
  general: 'bg-primary/20 text-primary',
  medical: 'bg-pink-500/20 text-pink-400',
  fire: 'bg-orange-500/20 text-orange-400',
  security: 'bg-blue-500/20 text-blue-400',
};

export function AlertsFeed({ alerts }: AlertsFeedProps) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <MapPin className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No recent alerts in your area</p>
        <p className="text-sm">Stay safe!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-lg">Recent Alerts</h3>
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="p-4 rounded-xl card-elevated border border-border/50 space-y-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-semibold">{alert.sender_name}</p>
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
      ))}
    </div>
  );
}
