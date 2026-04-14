import { User, LogOut, MapPin, Settings, Info, Shield, Flame, Heart, Bell, BellOff } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useOneSignal } from '@/hooks/useOneSignal';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VSLogo } from './VSLogo';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { useState } from 'react';
import { toast } from 'sonner';

interface ProfileHeaderProps {
  name: string;
  uniqueId: string;
  locationStatus?: 'active' | 'updating' | 'error';
  userRole?: 'user' | 'police' | 'fire_rescue' | 'medical' | null;
}

const ROLE_CONFIG = {
  user: { label: 'User', color: 'bg-blue-500/20 text-blue-400', icon: User },
  police: { label: 'Police', color: 'bg-indigo-500/20 text-indigo-400', icon: Shield },
  fire_rescue: { label: 'Fire & Rescue', color: 'bg-orange-500/20 text-orange-400', icon: Flame },
  medical: { label: 'Medical', color: 'bg-red-500/20 text-red-400', icon: Heart },
};

export function ProfileHeader({ name, uniqueId, locationStatus = 'active', userRole }: ProfileHeaderProps) {
  const { signOut } = useAuth();
  const { isSubscribed, requestPermission, unsubscribe } = useOneSignal();
  const [showAbout, setShowAbout] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleNotificationToggle = async () => {
    setIsToggling(true);
    try {
      if (isSubscribed) {
        await unsubscribe();
        toast.success('Push notifications disabled');
      } else {
        await requestPermission();
        toast.success('Push notifications enabled');
      }
    } catch (error) {
      toast.error('Failed to update notification settings');
    } finally {
      setIsToggling(false);
    }
  };

  const statusColors = {
    active: 'bg-success',
    updating: 'bg-warning animate-pulse',
    error: 'bg-destructive',
  };

  const roleConfig = userRole ? ROLE_CONFIG[userRole] : null;
  const RoleIcon = roleConfig?.icon;

  return (
    <>
      <header className="flex items-center justify-between p-4 safe-bottom">
        <div className="flex items-center gap-3">
          <VSLogo size="sm" />
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${statusColors[locationStatus]}`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-sm">{name}</p>
              {roleConfig && (
                <Badge className={`${roleConfig.color} text-[10px] px-1.5 py-0 h-4 flex items-center gap-1`}>
                  {RoleIcon && <RoleIcon className="w-2.5 h-2.5" />}
                  {roleConfig.label}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">ID: {uniqueId}</p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Settings className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center justify-between px-2 py-1.5">
              <div className="flex items-center gap-2">
                {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                <span className="text-sm">Notifications</span>
              </div>
              <Switch
                checked={isSubscribed}
                onCheckedChange={handleNotificationToggle}
                disabled={isToggling}
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="gap-2">
              <MapPin className="w-4 h-4" />
              <span>Location: {locationStatus}</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowAbout(true)} className="gap-2">
              <Info className="w-4 h-4" />
              <span>About App</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="gap-2 text-destructive">
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* About Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <VSLogo size="sm" />
              About VitalSync
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              VitalSync is an emergency response application designed to connect people in crisis with nearby help and emergency services.
            </p>
            <div className="space-y-2">
              <h4 className="font-semibold">Features:</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>One-tap SOS alerts to nearby users</li>
                <li>Role-based emergency routing (Police, Fire, Medical)</li>
                <li>Real-time location sharing</li>
                <li>Blood donation requests</li>
                <li>Emergency contact management</li>
                <li>Prescription image upload for medical emergencies</li>
              </ul>
            </div>
            <div className="space-y-2 pt-2 border-t">
              <h4 className="font-semibold">Developed by:</h4>
              <p className="text-sm text-muted-foreground">Subhash, Vishnuvarathan, Vijayan</p>
              <p className="text-sm text-muted-foreground font-medium">Maha Barathi Engineering College</p>
            </div>
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground">Version 1.0.0</p>
              <p className="text-xs text-muted-foreground">© 2024 VitalSync. All rights reserved.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
